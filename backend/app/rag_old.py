import os
import re

import uvicorn
from azure.cosmos.aio import CosmosClient as CosmosAsyncClient
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from loguru import logger
from openai import OpenAI
from profanity_check import predict

from configs.config import (
    CONTAINER_NAME,
    COSMOS_NOSQL_ACCOUNT_ENDPOINT,
    COSMOS_NOSQL_ACCOUNT_KEY,
    DATABASE_NAME,
    openai_api_base,
    openai_api_emb,
    openai_api_key,
)
from utils.util import (
    check_yono_query,
    generate_completion,
    generate_embedding,
    generate_multiple_query,
    get_spam_word,
    query_quality,
)

load_dotenv()

# --- OpenAI clients ---------------------------------------------------------
llm = OpenAI(api_key=openai_api_key, base_url=openai_api_base)
client = OpenAI(api_key=openai_api_key, base_url=openai_api_emb)

models_emb = client.models.list()
models_gen = llm.models.list()
vllm_model_emb = models_emb.data[0].id
vllm_model = models_gen.data[0].id

# --- FastAPI initialization & middleware ------------------------------------
app = FastAPI()
logger.info("FAST API INIT")

API_KEY = os.getenv("API_KEY")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_api_key(api_key_header: str = Depends(api_key_header)) -> str:
    if api_key_header != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return api_key_header


origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Cosmos DB --------------------------------------------------------------
cosmos_client = CosmosAsyncClient(
    url=COSMOS_NOSQL_ACCOUNT_ENDPOINT,
    credential=COSMOS_NOSQL_ACCOUNT_KEY,
)
container = None


async def init_db():
    logger.info("Starting init_db")
    logger.info(f"DataBase Name - {DATABASE_NAME}")
    logger.info(f"Container Name - {CONTAINER_NAME}")
    try:
        db = await cosmos_client.create_database_if_not_exists(id=DATABASE_NAME)
        cont = db.get_container_client(CONTAINER_NAME)
        logger.info("Completed init_db")
        return cont
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise HTTPException(status_code=500, detail="Error initializing database")


@app.on_event("startup")
async def startup_event():
    global container
    logger.info("Starting startup_event")
    container = await init_db()
    logger.info("Completed startup_event")


# --- Vector search helpers --------------------------------------------------
async def vector_search(query: str, num_results: int = 15):
    logger.info("Starting vector_search")
    try:
        query_embedding = await generate_embedding(query, vllm_model_emb)
        logger.info("Generated embedding for vector_search")

        results = container.query_items(
            query=(
                "SELECT TOP @num_results c.source, c.source_page, c.text, "
                "VectorDistance(c.vector, @embedding) AS SimilarityScore "
                "FROM c ORDER BY VectorDistance(c.vector, @embedding)"
            ),
            parameters=[
                {"name": "@embedding", "value": query_embedding},
                {"name": "@num_results", "value": num_results},
            ],
        )
        results_list = [item async for item in results]
        logger.info("Completed vector_search")
        return results_list
    except Exception as e:
        logger.error(f"Error during vector search: {e}")
        raise HTTPException(status_code=500, detail="Error during vector search")


async def fetch_yono_content_vector_db(error_code: str, num_results: int = 3):
    logger.info("Starting yono-specific vector_search")
    try:
        error_code_vector_search = f"exceptionCode:{error_code}"
        if error_code_vector_search == "exceptionCode:1":
            error_code_vector_search = "1: Fund Transfer"
        logger.info(f"error_code_vector_search: {error_code_vector_search}")

        results = container.query_items(
            query=(
                "SELECT TOP @num_results c.source, c.source_page, c.text, c.vector "
                "FROM c WHERE CONTAINS(c.text, @error_code)"
            ),
            parameters=[
                {"name": "@error_code", "value": error_code_vector_search},
                {"name": "@num_results", "value": num_results},
            ],
        )
        results_list = [item async for item in results]
        logger.info("Completed yono vector_search")
        return results_list
    except Exception as e:
        logger.error(f"Error during yono vector search: {e}")
        raise HTTPException(status_code=500, detail="Error during vector search")


# --- Input validation -------------------------------------------------------
async def validate_input(user_input: str) -> str:
    allowed_pattern = re.compile(r"^[a-zA-Z0-9?.,\s]+$")
    if len(user_input) > 200:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "GENAI006",
                "message": "Input exceeds 200 characters limit",
            },
        )
    if not allowed_pattern.match(user_input):
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "GENAI007",
                "message": (
                    "Input contains invalid characters. Only alphanumeric, "
                    "question mark, full stop, space & comma are allowed"
                ),
            },
        )
    return user_input


# --- Chatbot endpoint -------------------------------------------------------
@app.post("/asksbi/chatbot")
async def chatbot(request: Request, api_key: str = Depends(get_api_key)):
    logger.info("Starting chatbot endpoint")
    try:
        source: list = []
        context: list = []
        source_list: list | None = []
        ans: str | None = None
        err_code: str | None = None

        logger.info(f"Request: {request.method} {request.url}")
        data = await request.json()
        logger.info("Received request data")

        await validate_input(data["message"])

        spam_flag, in_flag, spam_word, pii_flag = await query_quality(data["message"])
        logger.info("Completed query_quality")

        spam_flag_2 = predict([data["message"]])
        logger.info("Completed profanity check")

        if spam_flag_2[0] == 0:
            if spam_flag == 1:
                logger.info(f"Spam words - {spam_word}")
                ans = (
                    f"Spam words detected in query: "
                    f"'{get_spam_word(spam_word)}'. "
                    "Please rephrase your query. Thank you!!!"
                )
                source_list = None
                err_code = "GENAI004"
            elif spam_flag == 2:
                ans = (
                    "Query length is too short to find a good answer. "
                    "Please type a longer query (min 4 words) "
                    "to get quality responses. Thank you!!!"
                )
                source_list = None
                err_code = "GENAI003"
            elif spam_flag == 3:
                ans = (
                    "Spam words detected in query. I am sorry, I cannot help with that. "
                    "Please rephrase your query. Thank you!!!"
                )
                source_list = None
                err_code = "GENAI009"
            elif in_flag == 1:
                ans = (
                    "Query language might not be in English. As of now I only support "
                    "English. Please rephrase your query. Thank you!!!"
                )
                source_list = None
            elif pii_flag:
                ans = (
                    "Query may contain PII information. "
                    "Kindly remove PII-related information."
                )
                source_list = None
            else:
                vector_search_query = await generate_multiple_query(data["message"])
                yono_query_classify = await check_yono_query(data["message"])

                search_results = await vector_search(vector_search_query)

                if yono_query_classify.get("is_yono_query") == 1:
                    yono_search_results = await fetch_yono_content_vector_db(
                        yono_query_classify["error_code"]
                    )
                    search_results = yono_search_results + search_results

                logger.info("Completed vector_search in chatbot endpoint")

                for result in search_results:
                    context.append(result["text"])
                    source.append(
                        (os.path.basename(result["source"]), result["source_page"])
                    )

                source = set(source)
                for item in source:
                    source_list.append(
                        {"filename": item[0], "page_no": item[1] + 1}
                    )

                logger.info(context)

                completions_results = await generate_completion(
                    data["message"], context
                )
                logger.info("Completed generate_completion in chatbot endpoint")
                ans = completions_results.choices[0].message.content

                source_blocking_list = [
                    "provided context does not contain",
                    "i cannot answer this",
                    "not mentioned in the document",
                    "not explicitly mentioned",
                    "information is not sufficient to answer",
                    "please ask a question about services of sbi",
                ]

                if any(
                    blocking_phrase in ans.lower()
                    for blocking_phrase in source_blocking_list
                ):
                    logger.info("Inside denial")
                    ans = (
                        "Sorry, I am not able to serve your request. "
                        "Please try asking your query related to asksbi. Thank you!!!"
                    )
                    source_list = None
                    err_code = "GENAI002"
        else:
            ans = (
                "Spam words detected in query. I am sorry, I cannot help with that. "
                "Please rephrase your query. Thank you!!!"
            )
            source_list = None
            err_code = "GENAI009"

        logger.info(f"source print: {source_list}")
        logger.info(f"Response body: {ans}")
        logger.info("Completed chatbot endpoint")

        response_content = (
            {"response": ans, "source": source_list}
            if source_list is not None
            else {"response": ans}
        )
        if err_code:
            response_content["err_code"] = err_code

        return JSONResponse(
            content=response_content,
            media_type="application/json; charset=utf-8",
        )

    except HTTPException as e:
        logger.error(f"HTTP error in chatbot endpoint: {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Error in chatbot endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error processing request",
            headers={"err_code": "GENAI500"},
        )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
