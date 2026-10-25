"""discounts and stock adjustments

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-25
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales",
        sa.Column(
            "discount_amount",
            sa.Numeric(12, 2),
            nullable=False,
            server_default=sa.text("0.00"),
        ),
    )
    op.create_table(
        "stock_adjustments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "product_id",
            sa.Integer(),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(50), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "unit_cost",
            sa.Numeric(12, 2),
            nullable=False,
            server_default=sa.text("0.00"),
        ),
        sa.Column(
            "total_loss",
            sa.Numeric(12, 2),
            nullable=False,
            server_default=sa.text("0.00"),
        ),
        sa.Column(
            "adjusted_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("quantity > 0", name="ck_stock_adjustments_quantity_positive"),
    )
    op.create_index(
        "idx_stock_adjustments_date",
        "stock_adjustments",
        ["created_at"],
    )
    op.create_index(
        "idx_stock_adjustments_product",
        "stock_adjustments",
        ["product_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_stock_adjustments_product", table_name="stock_adjustments")
    op.drop_index("idx_stock_adjustments_date", table_name="stock_adjustments")
    op.drop_table("stock_adjustments")
    op.drop_column("sales", "discount_amount")
