export const TOPICS = [
  {
    id: "accounts",
    label: "Accounts",
    tagline: "Open, manage & close savings",
    icon: "wallet",
    accent: "from-brand-400/25 to-brand-500/5",
    samples: [
      "How do I open a savings account?",
      "What's the process to close my account?",
      "What's the minimum balance for a premium savings account?",
    ],
  },
  {
    id: "loans",
    label: "Loans",
    tagline: "Home, personal & eligibility",
    icon: "home",
    accent: "from-pie-blue/25 to-pie-blue/5",
    samples: [
      "Am I eligible for a home loan?",
      "What are the personal loan interest rates?",
      "What is the pre-closure charge on personal loans?",
    ],
  },
  {
    id: "cards",
    label: "Cards",
    tagline: "Credit cards & rewards",
    icon: "card",
    accent: "from-pie-gold/30 to-brand-500/5",
    samples: [
      "My credit card was stolen — what should I do?",
      "How do I earn reward points?",
      "What is the fuel surcharge waiver?",
    ],
  },
  {
    id: "deposits",
    label: "Deposits",
    tagline: "FD rates & TDS rules",
    icon: "vault",
    accent: "from-pie-violet/25 to-pie-violet/5",
    samples: [
      "What are the current FD interest rates?",
      "Do senior citizens get extra interest?",
      "When does TDS apply on FD interest?",
    ],
  },
  {
    id: "transfers",
    label: "Transfers",
    tagline: "NEFT, RTGS & IMPS",
    icon: "send",
    accent: "from-pie-red/25 to-pie-red/5",
    samples: [
      "What is the difference between NEFT and RTGS?",
      "What is the IMPS transaction limit?",
      "Are NEFT transfers free online?",
    ],
  },
  {
    id: "compliance",
    label: "KYC & Compliance",
    tagline: "KYC, AML & PEPs",
    icon: "shield",
    accent: "from-pie-blue/25 to-pie-violet/5",
    samples: [
      "How often must KYC be updated?",
      "What triggers an AML report?",
      "What is enhanced due diligence?",
    ],
  },
  {
    id: "fraud",
    label: "Fraud & Disputes",
    tagline: "Report & recover",
    icon: "alert",
    accent: "from-pie-red/30 to-brand-500/5",
    samples: [
      "How do I report a fraudulent transaction?",
      "What is the zero-liability window?",
      "Do I need to file an FIR?",
    ],
  },
  {
    id: "digital",
    label: "Digital Banking",
    tagline: "Mobile, OTP & security",
    icon: "lock",
    accent: "from-pie-green/25 to-pie-blue/5",
    samples: [
      "How is mobile banking secured?",
      "What happens after 3 wrong PIN attempts?",
      "When should I share my OTP?",
    ],
  },
];

export function findTopic(id) {
  return TOPICS.find((t) => t.id === id) ?? null;
}
