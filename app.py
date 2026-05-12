import streamlit as st
import google.generativeai as genai
import json
import os
import re
from datetime import datetime
from io import BytesIO
from docx import Document

# --- Налаштування Gemini ---
# Отримання ключа
api_key = st.secrets.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY")

if api_key:
    try:
        genai.configure(api_key=api_key.strip())
    except Exception as e:
        st.error(f"Помилка конфігурації API: {e}")
        api_key = None

# --- Функції Експорту ---
def export_to_docx(decision):
    try:
        doc = Document()
        doc.add_heading('Аналітичний звіт про рішення', 0)
        
        doc.add_heading('Запит', level=1)
        doc.add_paragraph(decision.get('query', 'Без назви'))
        doc.add_paragraph(f"Дата: {decision.get('timestamp', '')}")
        
        analysis = decision.get('analysis', {})
        
        doc.add_heading('Переваги та Недоліки', level=1)
        doc.add_heading('Переваги:', level=2)
        for p in analysis.get('prosCons', {}).get('pros', []):
            doc.add_paragraph(f"• {p}")
        
        doc.add_heading('Недоліки:', level=2)
        for c in analysis.get('prosCons', {}).get('cons', []):
            doc.add_paragraph(f"• {c}")
        
        doc.add_heading('SWOT Аналіз', level=1)
        swot = analysis.get('swot', {})
        for label, key in [("Сильні сторони", 'strengths'), ("Слабкі сторони", 'weaknesses'), ("Можливості", 'opportunities'), ("Загрози", 'threats')]:
            doc.add_heading(label, level=2)
            for item in swot.get(key, []):
                doc.add_paragraph(f"• {item}")
                
        doc.add_heading('Підсумок', level=1)
        doc.add_paragraph(analysis.get('summary', ''))
        
        bio = BytesIO()
        doc.save(bio)
        return bio.getvalue()
    except Exception as e:
        st.error(f"Помилка створення файлу: {e}")
        return None

# --- Логіка AI ---
def get_ai_analysis(query):
    prompt = f"""
    Проаналізуй рішення: "{query}"
    Надай відповідь виключно в форматі JSON українською мовою.
    Структура: {{"prosCons": {{"pros": [], "cons": []}}, "swot": {{"strengths": [], "weaknesses": [], "opportunities": [], "threats": []}}, "summary": ""}}
    """
    
    # Список моделей для спроби
    candidates = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro']
    
    for model_name in candidates:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            
            if response and response.text:
                # Очищення від markdown ```json ... ```
                clean_text = re.sub(r'```json\s?|\s?```', '', response.text).strip()
                return json.loads(clean_text)
        except Exception as e:
            if "404" in str(e) or "not found" in str(e).lower():
                continue # Пробуємо наступну модель
            st.error(f"Помилка моделі {model_name}: {str(e)}")
            return None
    
    st.error("❌ Не вдалося знайти доступну модель. Перевірте API ключ та регіональні обмеження.")
    return None

# --- UI ---
st.set_page_config(page_title="Аналізатор рішень", page_icon="🧠")

if "history" not in st.session_state:
    st.session_state.history = []

st.title("🧠 Аналізатор рішень")

if not api_key:
    st.warning("⚠️ GEMINI_API_KEY не знайдено в Secrets.")
else:
    user_query = st.text_area("Яке рішення ви обмірковуєте?", placeholder="Наприклад: Чи варто починати новий проект зараз?")
    
    if st.button("Проаналізувати ✨", use_container_width=True):
        if user_query:
            with st.spinner("ШІ зважує аргументи..."):
                res = get_ai_analysis(user_query)
                if res:
                    st.session_state.history.insert(0, {
                        "query": user_query,
                        "timestamp": datetime.now().strftime("%d.%m.%Y %H:%M"),
                        "analysis": res
                    })
                    st.success("Аналіз успішно проведено!")
        else:
            st.info("Будь ласка, введіть запит.")

    if st.session_state.history:
        curr = st.session_state.history[0]
        st.divider()
        st.header(f"Аналіз: {curr['query']}")
        
        # Експорт
        doc_data = export_to_docx(curr)
        if doc_data:
            st.download_button("📂 Скачати звіт Word", data=doc_data, file_name="analiz.docx")
        
        # Результати
        c1, c2 = st.columns(2)
        with c1:
            st.success("**Плюси**")
            for p in curr['analysis']['prosCons'].get('pros', []): st.write(f"• {p}")
        with c2:
            st.error("**Мінуси**")
            for c in curr['analysis']['prosCons'].get('cons', []): st.write(f"• {c}")
            
        st.subheader("SWOT-аналіз")
        swot = curr['analysis'].get('swot', {})
        cols = st.columns(4)
        labels = [("S", 'strengths'), ("W", 'weaknesses'), ("O", 'opportunities'), ("T", 'threats')]
        for i, (label, key) in enumerate(labels):
            with cols[i]:
                st.info(f"**{label}**")
                for x in swot.get(key, []): st.caption(x)
        
        st.success(f"💡 **Підсумок:** {curr['analysis'].get('summary', '')}")

st.sidebar.title("📜 Історія")
for i, h in enumerate(st.session_state.history):
    if st.sidebar.button(f"{h['timestamp']}: {h['query'][:15]}...", key=f"h_{i}"):
        st.session_state.history.insert(0, st.session_state.history.pop(i))
        st.rerun()
