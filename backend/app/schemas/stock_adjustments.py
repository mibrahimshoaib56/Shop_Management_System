from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class StockAdjustmentCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, description="Number of units to write off / adjust")
    reason: str = Field(min_length=1, max_length=50, description="e.g. Damaged, Expired, Audit Loss, Internal Use")
    notes: str | None = Field(default=None, max_length=500)


class StockAdjustmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    reason: str
    notes: str | None
    unit_cost: Decimal
    total_loss: Decimal
    adjusted_by: int | None
    created_at: datetime
    product_name: str | None = None
    product_sku: str | None = None
    cashier_username: str | None = None
