
from dataclasses import dataclass


@dataclass
class Order:
    order_id: str
    amount: float
    discount_percent: int
    status: str = "created"


def process_order(order: Order) -> Order:
    """Pause an order when its discount requires manager approval."""

    if order.discount_percent > 20:
        order.status = "waiting_for_manager"
    else:
        order.status = "confirmed"

    return order


def review_order(order: Order, approved: bool) -> Order:
    """Apply the manager's decision."""

    if order.status != "waiting_for_manager":
        raise ValueError("Order is not waiting for approval")

    if approved:
        order.status = "confirmed"
    else:
        order.status = "rejected"

    return order
