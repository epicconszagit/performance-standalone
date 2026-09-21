"""add department financial records table and annual_budget_target

Revision ID: f8c3a2b1d9e7
Revises: e7b2c9d4a1f8
Create Date: 2026-09-21 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f8c3a2b1d9e7'
down_revision = 'e7b2c9d4a1f8'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add annual_budget_target column to departments
    with op.batch_alter_table('departments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('annual_budget_target', sa.Float(), nullable=True, server_default='0.0'))

    # 2. Create department_financial_records table
    op.create_table(
        'department_financial_records',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('department_id', sa.String(length=36), sa.ForeignKey('departments.id'), nullable=False),
        sa.Column('record_type', sa.String(length=20), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('currency', sa.String(length=10), nullable=True, server_default='USD'),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True, server_default='General'),
        sa.Column('transaction_date', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('recorded_by_id', sa.String(length=36), nullable=True),
        sa.Column('recorded_by_name', sa.String(length=255), nullable=True),
        sa.Column('created_date', sa.DateTime(), nullable=True),
        sa.Column('updated_date', sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table('department_financial_records')
    with op.batch_alter_table('departments', schema=None) as batch_op:
        batch_op.drop_column('annual_budget_target')
