"""Generate the Watt business model proposal as a DOCX document."""

from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "Watt_BM_요금제_제안서_2026-10-04.docx"
NAVY = RGBColor(26, 45, 69)
BLUE = RGBColor(38, 99, 167)
MUTED = RGBColor(88, 103, 119)
FX_KRW_PER_USD = 1_500  # 가격 검증용 가정값. 실제 결제 환율이 아니다.
RETRY_MULTIPLIER = 1.20  # 과금되는 실패·재시도 비용의 보수적 예비율
DEEPSEEK_PEAK_INPUT_USD_PER_M = 0.30
DEEPSEEK_PEAK_OUTPUT_USD_PER_M = 1.20
HAIKU_INPUT_USD_PER_M = 1.00
HAIKU_OUTPUT_USD_PER_M = 5.00

# 요청 1회당 토큰은 실측값이 아닌 보수적 시나리오다. 출력은 코드상 상한 이내다.
AI_TASKS = [
    ("텍스트 아이디어 추출", "DeepSeek Flash", 1, 3_000, 3_000),
    ("아이디어 비교·초안 진단", "DeepSeek Flash", 1, 5_000, 4_096),
    ("이미지 OCR·아이디어 추출 (최대 3장)", "Claude Haiku 4.5", 4, 6_000, 5_000),
    ("MVP 계획 생성", "DeepSeek Flash", 2, 5_000, 5_000),
    ("발표자료 생성·전체 재생성", "DeepSeek Flash", 4, 8_000, 16_000),
]


def ai_call_cost_krw(task):
    _, provider, _, input_tokens, output_tokens = task
    if provider == "Claude Haiku 4.5":
        input_rate, output_rate = HAIKU_INPUT_USD_PER_M, HAIKU_OUTPUT_USD_PER_M
    else:
        input_rate, output_rate = DEEPSEEK_PEAK_INPUT_USD_PER_M, DEEPSEEK_PEAK_OUTPUT_USD_PER_M
    return (
        (input_tokens * input_rate + output_tokens * output_rate)
        / 1_000_000
        * FX_KRW_PER_USD
        * RETRY_MULTIPLIER
    )


# 20크레딧 단위의 사용 혼합: 텍스트 2, 비교 2, 이미지 1, MVP 2, 발표 2회.
BASE_MIX_COUNTS = (2, 2, 1, 2, 2)
BASE_MIX_CREDITS = sum(task[2] * count for task, count in zip(AI_TASKS, BASE_MIX_COUNTS))
BASE_MIX_AI_KRW = sum(ai_call_cost_krw(task) * count for task, count in zip(AI_TASKS, BASE_MIX_COUNTS))


def estimate_profit(price_krw, credits, infra_krw, fee_rate=0.15, ai_multiplier=1.0):
    revenue_ex_vat = price_krw / 1.1
    fee = price_krw * fee_rate  # 보수적으로 표시 가격 전체에 수수료를 적용
    ai_cost = credits / BASE_MIX_CREDITS * BASE_MIX_AI_KRW * ai_multiplier
    contribution = revenue_ex_vat - fee - ai_cost - infra_krw
    return revenue_ex_vat, fee, ai_cost, contribution, contribution / revenue_ex_vat


def won(amount):
    return f"{amount:,.0f}원"


def set_font(run, size=10, bold=False, color=NAVY):
    run.font.name = "맑은 고딕"
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "맑은 고딕")
    return run


def add_text(paragraph, value, size=10, bold=False, color=NAVY):
    return set_font(paragraph.add_run(value), size, bold, color)


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def heading(doc, title):
    p = doc.add_paragraph(style="Heading 1")
    add_text(p, title, 13, True, BLUE)
    return p


def body(doc, text=""):
    p = doc.add_paragraph()
    add_text(p, text)
    return p


def bullet(doc, label, detail):
    p = doc.add_paragraph(style="List Bullet")
    add_text(p, label, 10, True)
    add_text(p, detail)
    return p


def table(doc, headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.style = "Table Grid"
    for i, title in enumerate(headers):
        cell = t.rows[0].cells[i]
        shade(cell, "DDEAF6")
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        add_text(cell.paragraphs[0], title, 9, True, NAVY)
    for row_index, row in enumerate(rows):
        cells = t.add_row().cells
        for i, value in enumerate(row):
            if row_index % 2 == 1:
                shade(cells[i], "F6F9FC")
            cells[i].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            add_text(cells[i].paragraphs[0], str(value), 8.5)
    if widths:
        for row in t.rows:
            for i, width in enumerate(widths):
                row.cells[i].width = Cm(width)
    doc.add_paragraph()
    return t


def link(paragraph, text, url):
    part = paragraph.part
    relationship_id = part.relate_to(
        url,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True,
    )
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), relationship_id)
    run = OxmlElement("w:r")
    properties = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "2663A7")
    properties.append(color)
    run.append(properties)
    text_element = OxmlElement("w:t")
    text_element.text = text
    run.append(text_element)
    hyperlink.append(run)
    paragraph._p.append(hyperlink)


doc = Document()
section = doc.sections[0]
section.top_margin = Cm(1.7)
section.bottom_margin = Cm(1.6)
section.left_margin = Cm(1.8)
section.right_margin = Cm(1.8)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "맑은 고딕"
normal.font.size = Pt(10)
normal.paragraph_format.space_after = Pt(6)
normal.paragraph_format.line_spacing = 1.18
for style_name in ("Heading 1", "Heading 2"):
    styles[style_name].paragraph_format.space_before = Pt(11)
    styles[style_name].paragraph_format.space_after = Pt(4)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_text(p, "Watt 요금제 및 대학 제휴 제안서", 18, True)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_text(p, "무료 · 개인 구독 · 팀 구독 · 대학 제휴  |  2026년 10월 4일", 9, False, MUTED)

body(doc, "이 문서는 현재 앱의 팀 과제 흐름과 AI API 요금을 바탕으로 한 가격 실험안입니다. 판매 가격은 부가세 포함 가정이며, 원가·수수료·이익은 실제 사용량과 정산 내역이 없어 시나리오로 추정했습니다. 아래 공헌이익은 회사 전체 순이익이 아닙니다.")

heading(doc, "1. 권장 요금제 한눈에 보기")
table(
    doc,
    ["요금제", "제안 가격", "이용 단위", "AI 제공량", "핵심 대상"],
    [
        ["무료", "0원", "개인 계정", "가입 시 12크레딧 1회", "처음 과제를 시작하는 학생"],
        ["개인 구독", "월 5,900원\n4개월 19,900원", "개인 계정", "월 100크레딧", "혼자 기획·발표를 준비하는 학생"],
        ["팀 구독", "월 16,900원\n4개월 59,900원", "방 1개 / 최대 5명", "방 공동 월 300크레딧", "한 팀이 비용을 나눠 쓰는 과제"],
        ["대학 제휴", "1인·학기 8,000원\n최소 200명: 160만원", "수업·학과 계약", "1인·학기 60크레딧", "학교가 비용을 부담하는 수업"],
    ],
    [2.6, 3.1, 3.2, 3.2, 4.5],
)
body(doc, "월 구독은 매월 갱신됩니다. 4개월 상품은 한 학기용 기간제 이용권으로 제안하며 자동 갱신하지 않습니다. 개인 월 100·팀 공동 월 300크레딧을 우선 제안합니다. 팀 가격은 기존 14,900원 안에서 16,900원으로 올려 동일한 이익률 목표를 맞췄습니다. 대학 제휴 제공량도 학기당 60크레딧으로 확대했습니다.")

heading(doc, "2. 무엇을 무료로 두고, 어디에 과금할까")
bullet(doc, "무료 핵심: ", "아이디어 직접 입력, 방 초대, 마인드맵, 팀 평가, 진행 상태 확인, 기존 결과 열람과 기본 내보내기. 협업 자체를 막지 않아 팀 전체가 앱을 사용할 수 있게 합니다.")
bullet(doc, "유료 핵심: ", "텍스트·이미지에서 AI 아이디어 추출, AI 비교·분석, MVP 계획 생성, 발표자료 생성·재생성의 추가 이용량. 실제 서버 비용과 시간 절감 가치가 생기는 지점입니다.")
bullet(doc, "내보내기 원칙: ", "사용자가 작성한 내용과 이미 생성된 결과의 기본 DOCX·PDF·PPTX 저장은 구독 만료 뒤에도 허용합니다. 유료 전용 템플릿은 별도 기능을 만든 뒤 검토합니다.")

heading(doc, "3. AI 크레딧 사용 규칙 — 제안")
table(
    doc,
    ["AI 작업", "차감"],
    [
        ["텍스트 아이디어 추출 또는 아이디어 비교·초안 진단", "1크레딧 / 실행"],
        ["이미지 글자 추출·아이디어 추출 (최대 3장)", "4크레딧 / 실행"],
        ["MVP 계획 생성", "2크레딧 / 실행"],
        ["발표자료 최초 생성 또는 전체 재생성", "4크레딧 / 실행"],
    ],
    [12.4, 4.2],
)
body(doc, "텍스트 추출 1회 + 비교 1회 + MVP 1회 + 발표자료 1회 = 8크레딧. 무료 12크레딧이면 이 흐름을 한 번 완주하고 발표자료를 한 번 재생성할 수 있습니다. 이미지로 시작하는 흐름은 11크레딧입니다. 이미지 요청은 Claude 비용이 높아 기존 2에서 4크레딧으로 조정합니다. 성공한 결과만 차감하고, 월 제공 크레딧은 이월하지 않는 안을 권합니다.")

heading(doc, "3-1. 크레딧 부족 시 추가 충전")
body(doc, "무료·개인·팀 요금제 모두 기본 한도가 부족하면 크레딧을 일회성으로 추가 구매할 수 있게 제안합니다. 자동 충전은 사용하지 않으며, 요청 전에 필요한 크레딧과 남은 잔액을 보여줍니다.")
table(
    doc,
    ["추가 충전", "제안 가격", "적용 대상", "비고"],
    [
        ["10크레딧", "1,900원", "무료·개인·팀", "가끔 쓰는 이용자용"],
        ["30크레딧", "3,900원", "무료·개인·팀", "과제 마감 시 추가 사용용"],
        ["대학 제휴 추가량", "학교별 별도 견적", "계약 수업", "담당자 승인 후 일괄 증액"],
    ],
    [3.2, 2.6, 3.4, 7.4],
)
body(doc, "월 구독에 포함된 크레딧을 먼저 쓰고 구매한 크레딧을 나중에 사용합니다. 구매한 크레딧은 월말·구독 해지 시 소멸시키지 않는 안을 권합니다. 개인 충전분은 개인 계정에, 팀 충전분은 해당 방에 귀속합니다. 방 삭제·계정 탈퇴 시 잔액 처리 규칙은 출시 전 별도로 정해야 합니다.")
body(doc, "위 충전 가격 역시 가설입니다. 팀 구독의 크레딧 단가가 충전 단가보다 낮도록 두어 정기 이용자에게 구독의 이점이 남게 했습니다. 앱스토어에서 유료 크레딧을 판매하면 일회성 인앱 상품으로 구성하고 플랫폼별 결제 정책을 따릅니다.")

heading(doc, "4. 요금제별 제공 범위")
table(
    doc,
    ["항목", "무료", "개인 구독", "팀 구독", "대학 제휴"],
    [
        ["활성 과제", "1개", "3개", "방당 10개", "계약 수업 범위"],
        ["협업", "최대 5명 방 참여", "무료와 동일", "최대 5명 공동 이용", "수업 참여자 공동 이용"],
        ["AI 이용량", "가입 시 12크레딧", "월 100크레딧", "방 공동 월 300크레딧", "1인·학기 60크레딧"],
        ["결제 책임", "없음", "구독자", "방장 등 결제자 1명", "대학·학과·교수 측"],
        ["학교 관리", "없음", "없음", "없음", "수업별 이용 현황·초대 관리(개발 필요)"],
    ],
    [2.8, 3.2, 3.2, 3.5, 3.9],
)
body(doc, "개인 구독의 AI 크레딧은 다른 팀원에게 이전하지 않습니다. 팀 구독은 방에 귀속되므로 결제자 한 명만 유료여도 방의 모든 멤버가 공동 한도를 사용합니다. 기존 과제의 읽기·내보내기는 해지 뒤에도 유지하는 설계를 권합니다.")

heading(doc, "5. 대학생 인증 할인과 대학 제휴")
table(
    doc,
    ["혜택", "일반 가격", "대학생 인증 가격"],
    [
        ["개인 월 구독", "5,900원", "4,900원"],
        ["개인 4개월 이용권", "19,900원", "17,900원"],
        ["팀 월 구독", "16,900원", "14,900원"],
        ["팀 4개월 이용권", "59,900원", "49,900원"],
    ],
    [6.1, 5.2, 5.3],
)
body(doc, "학생 인증은 학교 이메일 인증과 1년 주기 재확인으로 시작합니다. 팀 할인은 결제자에게 학생 인증이 있을 때 적용합니다. 학교 계약에 포함된 학생은 계약 범위의 수업에서 별도 결제 없이 사용하며, 개인 구독과 학교 제공량은 중복 적립하지 않는 안을 권합니다.")
body(doc, "대학 제휴 기준가는 학생 1인당 4개월 학기 8,000원, 최소 200명 계약(160만원)입니다. 예를 들어 300명 수업은 학기 240만원입니다. 50~100명 규모의 유료 파일럿은 별도 정액 견적으로 운영하고, 정식 확대 전에 학교가 요구하는 관리·보안 기능을 확인합니다.")

heading(doc, "6. AI API 원가와 크레딧 설계")
body(doc, "2026년 10월 4일 공개 단가 기준: DeepSeek Flash는 피크·캐시 미스 입력 100만 토큰당 $0.30, 출력 $1.20입니다. Claude Haiku 4.5는 입력 $1, 출력 $5입니다. 앱 기본 설정은 텍스트에 DeepSeek Flash, 이미지에 Claude Haiku 4.5를 사용합니다. 아래 토큰 수는 실측이 아닌 기능별 보수적 가정이며, 환율 1달러=1,500원과 과금되는 실패·재시도 비용 20%를 더했습니다. 실제 환율·토큰·재시도율은 달라질 수 있습니다.")
table(
    doc,
    ["AI 작업", "입력/출력 토큰 가정", "크레딧", "API 원가/회"],
    [[task[0], f"{task[3]:,} / {task[4]:,}", str(task[2]), won(ai_call_cost_krw(task))] for task in AI_TASKS],
    [7.8, 4.4, 1.7, 2.7],
)
body(doc, f"대표 사용 혼합은 텍스트 추출 2회, 비교 2회, 이미지 1회, MVP 2회, 발표자료 2회로 총 {BASE_MIX_CREDITS}크레딧입니다. 이때 AI 원가는 약 {won(BASE_MIX_AI_KRW)}으로, 크레딧당 약 {won(BASE_MIX_AI_KRW / BASE_MIX_CREDITS)}입니다. 이미지 1회는 같은 크레딧 수의 텍스트 작업보다 비싸므로 4크레딧으로 설정했습니다. 한 요청에 3장까지 들어갈 수 있다는 점은 출시 전 이미지별 실측으로 다시 확인해야 합니다.")

heading(doc, "7. 결제 후 예상 이익 — 실측 순이익 아님")
body(doc, "계산식: 표시 가격 ÷ 1.1(부가세 제외 매출) − 표시 가격 × 플랫폼 수수료율 − 사용 크레딧 × 대표 혼합의 크레딧당 AI 원가 − 서버·스토리지 예비비 = 공헌이익. 수수료 15%는 자격 충족 또는 구독 판매를 가정한 시나리오이며, 보수적으로 부가세 포함 표시 가격 전체에 적용했습니다. 서버·스토리지 예비비는 개인 월 200원, 팀 월 500원, 대학생 학기당 500원의 미검증 가정입니다. 4개월권에는 월 예비비를 4배 적용합니다.")
offers = [
    ("개인 월", 5_900, 100, 200, 0.15),
    ("개인 월·학생", 4_900, 100, 200, 0.15),
    ("팀 월", 16_900, 300, 500, 0.15),
    ("팀 월·학생", 14_900, 300, 500, 0.15),
    ("개인 4개월", 19_900, 400, 800, 0.15),
    ("개인 4개월·학생", 17_900, 400, 800, 0.15),
    ("팀 4개월", 59_900, 1_200, 2_000, 0.15),
    ("팀 4개월·학생", 49_900, 1_200, 2_000, 0.15),
    ("대학 제휴·1인 학기", 8_000, 60, 500, 0.0),
    ("추가 충전 10", 1_900, 10, 0, 0.15),
    ("추가 충전 30", 3_900, 30, 0, 0.15),
]
profit_rows = []
for name, price, credits, infra, fee_rate in offers:
    revenue, fee, ai, profit, margin = estimate_profit(price, credits, infra, fee_rate)
    profit_rows.append([name, won(price), won(fee), won(ai), won(infra), f"{won(profit)} / {margin:.1%}"])
table(doc, ["상품", "판매가", "수수료", "AI 원가", "서버 예비", "공헌이익 / 이익률"], profit_rows, [3.9, 2.2, 2.2, 2.2, 2.2, 4.0])
body(doc, "위 이익률의 분모는 부가세 제외 매출입니다. 대학 제휴는 학교 직접 계약으로 앱스토어 수수료가 없는 경우만 계산했습니다. 학생 4개월권은 표에 적힌 별도 가격이며, 추가 프로모션 할인은 적용하지 않는 안입니다. 무료 12크레딧은 대표 혼합 기준 AI 약 120원에 별도 서버비가 드는 가입 유치 비용이며, 유료 사용자 수익에서 간접 회수해야 합니다.")
stress_rows = []
for name, price, credits, infra, _ in offers[:4]:
    _, _, _, base_profit, base_margin = estimate_profit(price, credits, infra)
    _, _, _, stress_profit, stress_margin = estimate_profit(price, credits, infra, 0.30, 2.0)
    stress_rows.append([name, f"{won(base_profit)} / {base_margin:.1%}", f"{won(stress_profit)} / {stress_margin:.1%}"])
table(doc, ["월 상품", "기준: 수수료 15%·위 AI 원가", "압박: 수수료 30%·AI 원가 2배"], stress_rows, [4.0, 6.3, 6.3])
body(doc, "압박 시나리오는 모든 사용자가 크레딧을 소진하고 AI 원가가 기준의 2배이며 플랫폼 수수료가 30%인 경우입니다. 실제 손익은 사용자별 사용량, 이미지 비중, 무료 가입자, 환불·프로모션, 지원 인건비, 마케팅비, 고정 서버비, 법인세에 따라 변합니다. 따라서 표의 공헌이익을 순이익으로 부르면 안 됩니다. 회사 순이익은 전체 공헌이익 합계에서 이 비용들을 추가로 뺀 뒤에만 계산할 수 있습니다.")
body(doc, "개인 학생가 3,900원에 100크레딧을 주면 위 압박 조건에서 약 177원만 남아 할인 안전폭이 좁습니다. 학생 월 4,900원, 4개월 17,900원으로 조정했습니다. 이 가격에 추가 할인은 중복 적용하지 않으며, 실측 원가가 높아지면 제공량 또는 가격을 먼저 재검토합니다.")
body(doc, "월 5,900원·100크레딧 개인 구독은 기준 가정에서 부가세 제외 매출 대비 공헌이익률 약 61%입니다. 팀 300크레딧을 월 14,900원에 팔면 약 58%로 목표 60%에 못 미칩니다. 월 16,900원으로 조정하면 약 61%가 됩니다. 이미지 2크레딧을 유지하면 이미지 위주 사용자의 원가가 과도해질 수 있어 4크레딧으로 올렸습니다. 이 결론은 토큰 가정이 달라지면 바뀝니다.")

heading(doc, "8. 가격 검증과 출시 순서")
bullet(doc, "1단계 — 실측: ", "Edge Function별 입력·출력 토큰, 이미지 장수, 실제 청구액, 실패·재시도율, 사용자별 월 사용량을 기록합니다. 목표는 일반 월 상품의 공헌이익률 60% 안팎과 할인 상품의 45% 이상입니다. 2주 실측치의 상위 사용자를 포함해 재계산한 뒤 크레딧·가격을 확정합니다.")
bullet(doc, "2단계 — 소규모 가격 실험: ", "개인 월 5,900원·100크레딧과 팀 월 16,900원·300크레딧을 20~30개 실제 팀에 제시합니다. 무료→유료 전환, 유료 팀의 크레딧 소진, 과제 완료율, 해지 이유를 봅니다.")
bullet(doc, "3단계 — 학교 파일럿: ", "1~2개 수업에서 교수·조교의 초대 및 이용 현황 요구를 확인합니다. 익명 집계 중심으로 설계하고, 학생 과제 내용의 개별 열람 권한은 별도 합의가 있을 때만 제공합니다.")

heading(doc, "9. 현재 구현 상태와 출시 전 작업")
body(doc, "현재 앱에는 과제 단계, 방 협업, AI Edge Functions, 발표자료 재생성·버전 비교, DOCX·PDF·PPTX 내보내기가 있습니다. 결제, 구독 권한, 사용량 원장, 학생 인증, 학교 관리자 화면은 이 제안서의 신규 개발 범위입니다. AI 한도는 화면 표시만으로 처리하지 말고 Edge Function 서버에서 방·사용자 권한과 사용량을 확인해야 합니다.")
body(doc, "모바일 앱에서 개인·팀 디지털 구독을 판매할 때는 Apple과 Google Play의 결제 정책을 채널별로 검토해야 합니다. 대학 기관 계약의 이용 권한 제공은 소비자 판매와 조건이 다를 수 있으므로 계약·배포 구조를 정한 뒤 확인합니다.")

heading(doc, "참고 자료")
sources = [
    ("Expo SDK 56 문서", "https://docs.expo.dev/versions/v56.0.0/"),
    ("DeepSeek API 모델별 요금", "https://api-docs.deepseek.com/quick_start/pricing/"),
    ("Claude API 모델별 요금", "https://platform.claude.com/docs/en/about-claude/pricing"),
    ("Apple 수수료 및 Small Business Program", "https://developer.apple.com/programs/whats-included/"),
    ("Google Play 서비스 수수료", "https://support.google.com/googleplay/android-developer/answer/112622?hl=en"),
    ("국세청 부가가치세율 자료", "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272"),
    ("Notion 교육 요금제 — 학교 이메일 및 재인증 사례", "https://www.notion.com/help/notion-for-education"),
    ("Figma for Education — 교육용 무료 제공과 AI 크레딧 사례", "https://help.figma.com/hc/en-us/articles/360041061214-Figma-for-Education"),
    ("Canva Campus — 대학 기관 계약 사례", "https://www.canva.com/en_gb/higher-education/faculty/"),
    ("Apple App Review Guidelines", "https://developer.apple.com/app-store/review/guidelines/"),
    ("Google Play Payments policy", "https://support.google.com/googleplay/android-developer/answer/9858738?hl=en"),
]
for name, url in sources:
    p = doc.add_paragraph(style="List Bullet")
    link(p, name, url)

footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
add_text(footer, "Watt | BM 가격 실험안 · 2026.10.04", 8, False, MUTED)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUTPUT)
print(OUTPUT)
