"""add department budget and contribution fields

Revision ID: e7b2c9d4a1f8
Revises: fde2f8d63c62
Create Date: 2026-09-21 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7b2c9d4a1f8'
down_revision = 'fde2f8d63c62'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('departments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('allocated_budget', sa.Float(), nullable=True, server_default='0.0'))
        batch_op.add_column(sa.Column('actual_spend', sa.Float(), nullable=True, server_default='0.0'))
        batch_op.add_column(sa.Column('budget_currency', sa.String(length=10), nullable=True, server_default='USD'))
        batch_op.add_column(sa.Column('fiscal_year', sa.String(length=20), nullable=True, server_default='2026'))
        batch_op.add_column(sa.Column('contribution_type', sa.String(length=50), nullable=True, server_default='Operational Support'))
        batch_op.add_column(sa.Column('revenue_generated', sa.Float(), nullable=True, server_default='0.0'))
        batch_op.add_column(sa.Column('strategic_weight', sa.Integer(), nullable=True, server_default='3'))
        batch_op.add_column(sa.Column('target_contribution_score', sa.Float(), nullable=True, server_default='85.0'))


def downgrade():
    with op.batch_alter_table('departments', schema=None) as batch_op:
        batch_op.drop_column('target_contribution_score')
        batch_op.drop_column('strategic_weight')
        batch_op.drop_column('revenue_generated')
        batch_op.drop_column('contribution_type')
        batch_op.drop_column('fiscal_year')
        batch_op.drop_column('budget_currency')
        batch_op.drop_column('actual_spend')
        batch_op.drop_column('allocated_budget')
