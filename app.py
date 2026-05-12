import streamlit as st
import google.generativeai as genai
import json
import os
from datetime import datetime
from io import BytesIO
from docx import Document
from fpdf import FPDF

# --- Налаштування Gemini ---
# На Streamlit Cloud ключ потрібно додати в "Secrets" проекту
if "GEMINI_API_KEY" in st.secrets:
    api_key = st.secrets["GEMINI_API_KEY"]
elif os.environ.get("GEMINI_API_KEY"):
    api_key = os.environ.get("GEMINI_API_KEY")
else:
    api_key = None

if api_key:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    st.warning("⚠️ GEMINI_API_KEY не знайдено. Додайте його в Secrets вашого Streamlit Share.")

# --- Функції Експорту ---
def export_to_docx(decision):
    doc = Document()
    doc.add_heading('Аналізатор рішень', 0)
    doc.add_paragraph(f"Запит: {decision['query']}")
    doc.add_paragraph(f"Дата: {decision['timestamp']}")
    
    doc.add_heading('Переваги та Недоліки', level=1)
    doc.add_heading('Переваги:', level=2)
    for p in decision['analysis']['prosCons']['pros']:
        doc.add_paragraph(f"• {p}")
    
    doc.add_heading('Недоліки:', level=2)
    for c in decision['analysis']['prosCons']['cons']:
        doc.add_paragraph(f"• {c}")
    
    doc.add_heading('SWOT Аналіз', level=1)
    for key, items in decision['analysis']['swot'].items():
        doc.add_heading(key.capitalize(), level=2)
        for item in items:
            doc.add_paragraph(f"• {item}")
            
    doc.add_heading('Підсумок', level=1)
    doc.add_paragraph(decision['analysis']['summary'])
    
    bio = BytesIO()
    doc.save(bio)
    return bio.getvalue()

def export_to_pdf(decision):
    pdf = FPDF()
    pdf.add_page()
    # Використовуємо Helvetica для PDF (зверніть увагу: стандартні шрифти fpdf можуть мати проблеми з кирилицею без завантаження зовнішніх шрифтів)
    pdf.set_font("Helvetica", size=12)
    
    pdf.cell(200, 10, txt="Analysis Report", ln=True, align='C')
    pdf.multi_cell(0, 10, txt=f"Query: {decision['query']}")
    pdf.ln(10)
    
    pdf.set_font("Helvetica", style='B', size=11)
    pdf.cell(0, 10, txt="Summary:", ln=True)
    pdf.set_font("Helvetica", size=10)
    pdf.multi_cell(0, 7, txt=decision['analysis']['summary'])
    
    return pdf.output()

# --- Логіка AI ---
def get_ai_analysis(query):
    prompt = f"""Analyze the following decision: "{query}"
    Provide structured analysis in Ukrainian.
    Output MUST be JSON with keys: 
    "prosCons": {{"pros": [], "cons": []}}, 
    "swot": {{"strengths": [], "weaknesses": [], "opportunities": [], "threats": []}}, 
    "summary": "string"
    """
    response = model.generate_content(prompt)
    try:
        # Очищення відповіді від markdown блоків
        text = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except:
        return None

# --- UI Налаштування ---
st.set_page_config(page_title="Аналізатор рішень", page_icon="🧠", layout="wide")

if "history" not in st.session_state:
    st.session_state.history = []

st.title("🧠 Аналізатор рішень")
st.subheader("ШІ допоможе прийняти зважене рішення")

with st.container():
    query = st.text_area("Введіть ваше запитання або дилему:", placeholder="Наприклад: Чи варто переїжджати в інше місто зараз?")
    
    if st.button("Аналізувати ✨"):
        if query and api_key:
            with st.spinner("ШІ зважує всі аргументи..."):
                analysis = get_ai_analysis(query)
                if analysis:
                    new_item = {
                        "id": len(st.session_state.history),
                        "query": query,
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
                        "analysis": analysis
                    }
                    st.session_state.history.insert(0, new_item)
                    st.success("Аналіз завершено!")
                else:
                    st.error("Помилка генерації аналізу. Спробуйте інше формулювання.")
        elif not api_key:
            st.error("Ключ API не налаштовано.")

# --- Відображення Результатів ---
if st.session_state.history:
    current = st.session_state.history[0]
    
    st.divider()
    
    col_header, col_actions = st.columns([3, 1])
    with col_header:
        st.header(f"Результат: {current['query']}")
    with col_actions:
        docx_data = export_to_docx(current)
        st.download_button(
            label="Скачати .docx",
            data=docx_data,
            file_name="decision_analysis.docx",
            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )

    # Pros & Cons
    c1, c2 = st.columns(2)
    with c1:
        st.info("✅ **Переваги**")
        for p in current['analysis']['prosCons']['pros']:
            st.write(f"- {p}")
    with c2:
        st.warning("❌ **Недоліки**")
        for c in current['analysis']['prosCons']['cons']:
            st.write(f"- {c}")

    # SWOT
    st.subheader("📐 SWOT Аналіз")
    s1, s2, s3, s4 = st.columns(4)
    with s1:
        st.success("**Strengths**")
        for x in current['analysis']['swot']['strengths']: st.caption(f"• {x}")
    with s2:
        st.error("**Weaknesses**")
        for x in current['analysis']['swot']['weaknesses']: st.caption(f"• {x}")
    with s3:
        st.info("**Opportunities**")
        for x in current['analysis']['swot']['opportunities']: st.caption(f"• {x}")
    with s4:
        st.warning("**Threats**")
        for x in current['analysis']['swot']['threats']: st.caption(f"• {x}")

    st.write("---")
    st.markdown(f"💡 **Рекомендація:** *{current['analysis']['summary']}*")

# --- Бічна панель Історії ---
st.sidebar.title("📚 Історія")
for h in st.session_state.history:
    if st.sidebar.button(f"{h['timestamp']}: {h['query'][:20]}...", key=f"hist_{h['id']}"):
        # У Streamlit складно "переключити" стан відображення без перерендера, 
        # у реальному додатку ми б змінили "selected_id" у st.session_state
        st.session_state.history.insert(0, st.session_state.history.pop(st.session_state.history.index(h)))
        st.rerun()
