export type ChinaMarketValueKind =
  | "text"
  | "amount"
  | "ratio"
  | "date"
  | "duration";

export interface ChinaMarketFieldDefinition {
  key: string;
  label: string;
  description: string;
  valueKind: ChinaMarketValueKind;
}

/**
 * Shared domain taxonomy for both the admin intake module and the public atlas.
 * It intentionally contains no province data or market conclusions.
 */
export const CHINA_MARKET_TOPICS = [
  {
    id: "trading-rules",
    index: "01",
    shortLabel: "交易规则",
    title: "电力市场交易规则",
    description: "分别记录现货日前、实时、辅助服务与零售市场规则，不从试运行推断正式运行。",
    fields: [
      {
        key: "spot_day_ahead_rule",
        label: "现货日前规则",
        description: "规则名称、运行阶段及适用范围。",
        valueKind: "text",
      },
      {
        key: "spot_real_time_rule",
        label: "现货实时规则",
        description: "实时市场规则、运行阶段及适用范围。",
        valueKind: "text",
      },
      {
        key: "ancillary_trading_rule",
        label: "辅助服务交易规则",
        description: "辅助服务市场规则及与现货市场的衔接方式。",
        valueKind: "text",
      },
      {
        key: "retail_trading_rule",
        label: "零售市场规则",
        description: "零售准入、交易和结算规则。",
        valueKind: "text",
      },
    ],
  },
  {
    id: "storage-capacity-compensation",
    index: "02",
    shortLabel: "容量补偿",
    title: "储能容量补偿（收益）",
    description: "补偿金额、考核、补贴时长与等效折算系数分别维护，不与输配电容量电价混用。",
    fields: [
      {
        key: "compensation_amount",
        label: "补偿金额",
        description: "保留原始计价单位、计价基础与适用对象。",
        valueKind: "amount",
      },
      {
        key: "assessment_mechanism",
        label: "考核机制",
        description: "可用率、响应或其他考核条件及扣减规则。",
        valueKind: "text",
      },
      {
        key: "subsidy_duration",
        label: "补贴时长",
        description: "政策承诺期限或项目适用期限。",
        valueKind: "duration",
      },
      {
        key: "equivalent_conversion_coefficient",
        label: "等效折算系数",
        description: "储能容量折算口径、系数与计算边界。",
        valueKind: "ratio",
      },
    ],
  },
  {
    id: "ancillary-services",
    index: "03",
    shortLabel: "辅助服务",
    title: "辅助服务品种及金额",
    description: "品种存在、储能可参与和存在公开价格是三个独立事实，均需原文依据。",
    fields: [
      {
        key: "service_products",
        label: "服务品种",
        description: "调频、备用、调峰等当地正式品种名称。",
        valueKind: "text",
      },
      {
        key: "storage_eligibility",
        label: "储能参与资格",
        description: "独立储能或联合主体的准入和技术条件。",
        valueKind: "text",
      },
      {
        key: "compensation_standard",
        label: "补偿金额 / 价格",
        description: "金额、价格上下限或补偿标准及原始单位。",
        valueKind: "amount",
      },
      {
        key: "settlement_and_assessment",
        label: "结算与考核",
        description: "计价基础、结算周期与性能考核要求。",
        valueKind: "text",
      },
    ],
  },
  {
    id: "fourth-regulatory-cycle-grid-cost",
    index: "04",
    shortLabel: "第四周期",
    title: "第四周期输配电容量 / 需量电价（用网成本）",
    description: "容量电价、需量电价与线损率保持独立字段，并记录适用电压等级和监管周期。",
    fields: [
      {
        key: "grid_capacity_tariff",
        label: "输配电容量电价",
        description: "第四监管周期用网容量电价及计价单位。",
        valueKind: "amount",
      },
      {
        key: "grid_demand_tariff",
        label: "输配电需量电价",
        description: "第四监管周期用网需量电价及计价单位。",
        valueKind: "amount",
      },
      {
        key: "line_loss_rate",
        label: "线损率",
        description: "分电压等级或适用范围记录核定线损率。",
        valueKind: "ratio",
      },
      {
        key: "voltage_scope_and_period",
        label: "电压等级与适用期",
        description: "对应电压等级、执行起止时间与用户类别。",
        valueKind: "text",
      },
    ],
  },
  {
    id: "storage-operating-costs",
    index: "05",
    shortLabel: "运行费用",
    title: "储能系统运行费用",
    description: "只记录有公开规则依据的系统运行相关费用，不用价差或行业均值替代。",
    fields: [
      {
        key: "cost_item",
        label: "费用项目",
        description: "政策或规则原文中的费用名称。",
        valueKind: "text",
      },
      {
        key: "cost_standard",
        label: "费用标准",
        description: "金额、费率及原始单位。",
        valueKind: "amount",
      },
      {
        key: "pricing_basis",
        label: "计费基础",
        description: "按容量、电量、次数、时长或其他基础计费。",
        valueKind: "text",
      },
      {
        key: "applicable_scope",
        label: "适用范围与执行期",
        description: "适用主体、电压等级、场景与有效期。",
        valueKind: "text",
      },
    ],
  },
  {
    id: "green-power-direct-connection",
    index: "06",
    shortLabel: "绿电直连",
    title: "绿电直连政策",
    description: "政策发布、项目准入、审批备案与源荷储配置要求分别核验。",
    fields: [
      {
        key: "policy_status",
        label: "政策状态",
        description: "草案、征求意见、已发布或已生效状态。",
        valueKind: "text",
      },
      {
        key: "eligible_projects",
        label: "适用项目",
        description: "项目类型、用户范围及准入条件。",
        valueKind: "text",
      },
      {
        key: "approval_and_filing",
        label: "审批 / 备案要求",
        description: "主管部门、程序及关键前置条件。",
        valueKind: "text",
      },
      {
        key: "source_load_storage_requirements",
        label: "源荷储配置要求",
        description: "绿电来源、负荷关系及储能配置边界。",
        valueKind: "text",
      },
      {
        key: "effective_date",
        label: "生效日期",
        description: "正式文件明确的施行日期。",
        valueKind: "date",
      },
    ],
  },
  {
    id: "retail-rules",
    index: "07",
    shortLabel: "零售规则",
    title: "零售规则及浮动比例",
    description: "浮动上限、下限、基准和结算规则分别保存，避免静默比较不同口径。",
    fields: [
      {
        key: "retail_access_rule",
        label: "零售准入规则",
        description: "售电公司、用户及聚合主体的准入条件。",
        valueKind: "text",
      },
      {
        key: "floating_upper_ratio",
        label: "浮动比例上限",
        description: "相对明确基准的上浮比例。",
        valueKind: "ratio",
      },
      {
        key: "floating_lower_ratio",
        label: "浮动比例下限",
        description: "相对明确基准的下浮比例。",
        valueKind: "ratio",
      },
      {
        key: "pricing_benchmark",
        label: "浮动基准",
        description: "燃煤基准价、市场均价或规则明确的其他基准。",
        valueKind: "text",
      },
      {
        key: "settlement_rule",
        label: "结算与执行规则",
        description: "结算周期、偏差处理、执行日期与适用用户。",
        valueKind: "text",
      },
    ],
  },
  {
    id: "renewable-mechanism-price",
    index: "08",
    shortLabel: "机制电价",
    title: "风光机制电价（136号文）",
    description:
      "承接发改价格〔2025〕136号文的省级机制电价方案。存量与增量项目、机制电量规模、执行期限与差价结算规则分别记录，不混用口径。",
    sourceDocument: {
      label: "发改价格〔2025〕136号文",
      href: "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202502/t20250209_1396066.html",
      title:
        "国家发展改革委 国家能源局《关于深化新能源上网电价市场化改革 促进新能源高质量发展的通知》",
    },
    fields: [
      {
        key: "provincial_implementation_rule",
        label: "省级承接文件",
        description: "承接136号文的省级实施方案名称、发文号与状态。",
        valueKind: "text",
      },
      {
        key: "existing_project_mechanism_price",
        label: "存量项目机制电价",
        description: "存量风光项目机制电价水平、电量口径及与燃煤基准价的衔接方式。",
        valueKind: "amount",
      },
      {
        key: "incremental_project_mechanism_price",
        label: "增量项目机制电价",
        description: "竞价形成的出清价格，或公布的竞价上限 / 下限及原始单位。",
        valueKind: "amount",
      },
      {
        key: "mechanism_volume_scale",
        label: "机制电量规模",
        description: "纳入机制的电量规模、比例或规模确定方式。",
        valueKind: "text",
      },
      {
        key: "execution_period",
        label: "执行期限",
        description: "机制电价执行期限及起止安排。",
        valueKind: "duration",
      },
      {
        key: "settlement_rule",
        label: "差价结算规则",
        description: "机制电价与市场交易均价的差价结算（多退少补）及费用疏导方式。",
        valueKind: "text",
      },
    ],
  },
] as const satisfies readonly {
  id: string;
  index: string;
  shortLabel: string;
  title: string;
  description: string;
  sourceDocument?: {
    label: string;
    href: string;
    title?: string;
  };
  fields: readonly ChinaMarketFieldDefinition[];
}[];

export type ChinaMarketTopicId = (typeof CHINA_MARKET_TOPICS)[number]["id"];

export const CHINA_MARKET_TOPIC_IDS = CHINA_MARKET_TOPICS.map(
  (topic) => topic.id,
) as [ChinaMarketTopicId, ...ChinaMarketTopicId[]];

export function getChinaMarketTopic(topicId: ChinaMarketTopicId) {
  return CHINA_MARKET_TOPICS.find((topic) => topic.id === topicId);
}

export function getChinaMarketFieldKeys(topicId: ChinaMarketTopicId): string[] {
  return getChinaMarketTopic(topicId)?.fields.map((field) => field.key) ?? [];
}
