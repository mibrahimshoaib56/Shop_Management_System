from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class KhataEntryModel(Base):
    """
    Ledger entry for a customer's Udhaar (credit) account.
    - type='credit'  → customer bought on credit (balance increases, customer owes more)
    - type='payment' → customer paid back (balance decreases)
    """
    __tablename__ = "khata_entries"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_khata_entries_amount_positive"),
        Index("idx_khata_entries_customer", "customer_id"),
        Index("idx_khata_entries_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    # 'credit' = added debt (sale on udhaar), 'payment' = cash payment received
    entry_type: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    # sale_id links back to the original POS transaction if entry_type='credit'
    sale_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    customer = relationship("CustomerModel", back_populates="ledger_entries")
    sale = relationship("SaleModel", lazy="joined")
    user = relationship("UserModel", lazy="joined")
