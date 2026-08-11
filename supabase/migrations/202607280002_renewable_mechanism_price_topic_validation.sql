-- Field whitelist and expected field count for the new
-- 'renewable-mechanism-price' topic (136号文 风光机制电价).
-- Must run after the enum value was committed by the previous migration.

create or replace function public.is_valid_china_province_topic_field(
  requested_topic public.province_topic_id,
  requested_field text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case requested_topic
    when 'trading-rules' then requested_field = any (array[
      'spot_day_ahead_rule',
      'spot_real_time_rule',
      'ancillary_trading_rule',
      'retail_trading_rule'
    ])
    when 'storage-capacity-compensation' then requested_field = any (array[
      'compensation_amount',
      'assessment_mechanism',
      'subsidy_duration',
      'equivalent_conversion_coefficient'
    ])
    when 'ancillary-services' then requested_field = any (array[
      'service_products',
      'storage_eligibility',
      'compensation_standard',
      'settlement_and_assessment'
    ])
    when 'fourth-regulatory-cycle-grid-cost' then requested_field = any (array[
      'grid_capacity_tariff',
      'grid_demand_tariff',
      'line_loss_rate',
      'voltage_scope_and_period'
    ])
    when 'storage-operating-costs' then requested_field = any (array[
      'cost_item',
      'cost_standard',
      'pricing_basis',
      'applicable_scope'
    ])
    when 'green-power-direct-connection' then requested_field = any (array[
      'policy_status',
      'eligible_projects',
      'approval_and_filing',
      'source_load_storage_requirements',
      'effective_date'
    ])
    when 'retail-rules' then requested_field = any (array[
      'retail_access_rule',
      'floating_upper_ratio',
      'floating_lower_ratio',
      'pricing_benchmark',
      'settlement_rule'
    ])
    when 'renewable-mechanism-price' then requested_field = any (array[
      'provincial_implementation_rule',
      'existing_project_mechanism_price',
      'incremental_project_mechanism_price',
      'mechanism_volume_scale',
      'execution_period',
      'settlement_rule'
    ])
    else false
  end;
$$;

create or replace function public.expected_china_province_topic_field_count(
  requested_topic public.province_topic_id
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case requested_topic
    when 'green-power-direct-connection' then 5
    when 'retail-rules' then 5
    when 'renewable-mechanism-price' then 6
    else 4
  end;
$$;
