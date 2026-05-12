import streamlit as st
import google.generativeai as genai
import json
import os
import re
from datetime import datetime
from io import BytesIO
from docx import Document

# --- Налаштування Gemini ---
# Отримання ключа з різних джерел
api_key = st.secrets.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY")

if api_key:
    try:
        genai.configure(api_key=api_key)
    except Exception as e:
        st.error(f"Помилка конфігурації API: {e}")
        api_key = None
else:
    api_key = None

# --- Функції Експорту ---
def export_to_docx(decision):
    doc = Document()
    doc.add_heading('Аналітичний звіт про рішення', 0)
    
    doc.add_heading('Запит', level=1)
    doc.add_paragraph(decision['query'])
    doc.add_paragraph(f"Дата проведення аналізу: {decision['timestamp']}")
    
    doc.add_heading('Переваги та Недоліки', level=1)
    doc.add_heading('Переваги:', level=2)
    for p in decision['analysis'].get('prosCons', {}).get('pros', []):
        doc.add_paragraph(f"• {p}")
    
    doc.add_heading('Недоліки:', level=2)
    for c in decision['analysis'].get('prosCons', {}).get('cons', []):
        doc.add_paragraph(f"• {c}")
    
    doc.add_heading('SWOT Аналіз', level=1)
    swot = decision['analysis'].get('swot', {})
    for label, key in [("Сильні сторони (Strengths)", 'strengths'), 
                         ("Слабкі сторони (Weaknesses)", 'weaknesses'), 
                         ("Можливості (Opportunities)", 'opportunities'), 
                         ("Загрози (Threats)", 'threats')]:
        doc.add_heading(label, level=2)
        items = swot.get(key, [])
        for item in items:
            doc.add_paragraph(f"• {item}")
            
    doc.add_heading('Підсумок та рекомендація', level=1)
    doc.add_paragraph(decision['analysis'].get('summary', ''))
    
    bio = BytesIO()
    doc.save(bio)
    return bio.getvalue()

# --- Логіка AI ---
def get_ai_analysis(query):
    # Додамо логування для відладки (видно в логах Streamlit)
    print(f"DEBUG: Processing query: {query[:50]}")
    
    prompt = f"""
    Проаналізуй рішення: "{query}"
    Надай JSON: {{"prosCons": {{"pros": [], "cons": []}}, "swot": {{"strengths": [], "weaknesses": [], "opportunities": [], "threats": []}}, "summary": ""}}
    Мова: українська.
    """
    
    try:
        # Спробуємо стандартну назву моделі
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Спроба виклику
        response = model.generate_content(prompt)
        
        if not response:
            return None
            
        # Очищення тексту
        res_text = response.text
        if not res_text:
            return None
            
        clean_text = re.sub(r'```json\s?|\s?```', '', res_text).strip()
        return json.loads(clean_text)
    except Exception as e:
        err_msg = str(e)
        if "404" in err_msg or "not found" in err_msg.lower():
            st.error(f"⚠️ Модель не знайдена (404).")
            with st.expander("🔍 Відлагодити доступні моделі"):
                try:
                    models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
                    st.write("Список доступних моделей у вашому API ключі:")
                    st.write(models)
                    st.info("Якщо ви бачите 'gemini-1.5-flash-latest' або інші назви, спробуйте їх.")
                except Exception as list_err:
                    st.write(f"Не вдалося отримати список моделей: {list_err}")
            
            # Спроба використати завідомо існуючу стару модель
            try:
                backup_model = genai.GenerativeModel('gemini-pro')
                response = backup_model.generate_content(prompt)
                res_text = response.text
                clean_text = re.sub(r'```json\s?|\s?```', '', res_text).strip()
                return json.loads(clean_text)
            except:
                pass
        
        st.error(f"⚠️ Помилка Gemini API: {err_msg}")
        return None

# --- UI ---
st.set_page_config(page_title="Аналізатор рішень", page_icon="🧠")

if "history" not in st.session_state:
    st.session_state.history = []

st.title("🧠 Аналізатор рішень")

if not api_key:
    st.warning("⚠️ Ключ API не знайдено. Переконайтеся, що ви додали `GEMINI_API_KEY` у розділ Settings -> Secrets вашого Streamlit Cloud.")
else:
    query_input = st.text_area("Яке рішення ви обмірковуєте?", height=120, placeholder="Наприклад: Чи варто прийняти пропозицію роботи в іншому місті?")
    
    if st.button("Проаналізувати за допомогою ШІ ✨", use_container_width=True):
        if query_input:
            with st.spinner("Зважуємо всі ризики та можливості..."):
                res = get_ai_analysis(query_input)
                if res:
                    st.session_state.history.insert(0, {
                        "query": query_input,
                        "timestamp": datetime.now().strftime("%d.%m.%Y %H:%M"),
                        "analysis": res
                    })
                    st.success("Готово!")
                else:
                    st.error("Не вдалося отримати аналіз. Спробуйте змінити запит або перевірте ключ.")
        else:
            st.info("Введіть текст запиту для початку.")

    if st.session_state.history:
        curr = st.session_state.history[0]
        st.divider()
        st.header(f"Аналіз: {curr['query']}")
        
        # Кнопки експорту
        st.download_button(
            "⬇️ Скачати звіт Word (.docx)",
            data=export_to_docx(curr),
            file_name="analiz_rishennya.docx",
            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        
        # Результати
        p1, p2 = st.columns(2)
        with p1:
            st.success("✅ **Плюси**")
            for p in curr['analysis']['prosCons']['pros']: st.write(f"• {p}")
        with p2:
            st.error("❌ **Мінуси**")
            for c in curr['analysis']['prosCons']['cons']: st.write(f"• {c}")
            
        st.subheader("SWOT-аналіз")
        s1, s2, s3, s4 = st.columns(4)
        with s1: st.info("**S**\n" + "\n".join([f"- {x}" for x in curr['analysis']['swot']['strengths']]))
        with s2: st.warning("**W**\n" + "\n".join([f"- {x}" for x in curr['analysis']['swot']['weaknesses']]))
        with s3: st.info("**O**\n" + "\n".join([f"- {x}" for x in curr['analysis']['swot']['opportunities']]))
        with s4: st.error("**T**\n" + "\n".join([f"- {x}" for x in curr['analysis']['swot']['threats']]))
        
        st.info(f"💡 **Підсумок:** {curr['analysis']['summary']}")

# Sidebar
st.sidebar.title("Історія")
for i, h in enumerate(st.session_state.history):
    if st.sidebar.button(f"{h['timestamp']}: {h['query'][:20]}...", key=f"h_{i}"):
        st.session_state.history.insert(0, st.session_state.history.pop(i))
        st.rerun()
