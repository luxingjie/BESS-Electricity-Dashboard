/**
 * Aligned with Jinko ESS「储能与 ESG 政策月报」栏目结构（中文正文）。
 * 样本：4.11–5.10 / 5.11–6.12 / 6.12–7.12 三期月报。
 *
 * 导出由 `policyRowsToMarkdown` / `policyRowsToCsv` 生成。
 */
export const POLICY_BRIEF_TEMPLATE_SECTIONS = [
  "说明：（***）重要影响；跳过纯鼓励/低重要性；中国政策仅中文",
  "国内相关政策 → 国家政策",
  "国内相关政策 → 区域政策",
  "海外相关政策 → 欧洲 / 亚太 / 北美 / 拉美",
  "单条：标题（可带 ***）+ 日期·地区 + 影响摘要（含关键数字）+ 原文链接",
] as const;

export const POLICY_BRIEF_TEMPLATE_MARKDOWN_EXAMPLE = `# 储能与 ESG 政策动态（YYYY-MM-DD – YYYY-MM-DD）

 对晶科储能可能存在重要影响的政策，以（***）标出；不收录纯鼓励类、重要性较低或无显著影响条目。
 中国相关政策仅保留中文。
 导出范围：全球（全部） · 共 N 条

## 国内相关政策

## 国家政策

### （***）〈国家级政策标题〉

YYYY-MM-DD · 中国

〈影响摘要：关键数字、执行期、对储能收益/并网/容量机制的可执行变化〉

[〈来源机构〉](https://official.example/path)

## 区域政策

### （***）〈省级政策标题〉

YYYY-MM-DD · 山东

〈影响摘要〉

[〈来源机构〉](https://official.example/path)

## 海外相关政策

## 欧洲

### （***）〈海外政策标题〉

YYYY-MM-DD · 德国

〈中文影响摘要〉

[〈来源机构〉](https://official.example/path)
`;
