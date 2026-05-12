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
        # Використовуємо повну назву моделі для надійності
        model = genai.GenerativeModel('models/gemini-1.5-flash')
    except Exception as e:
        st.error(f"Помилка ініціалізації моделі: {e}")
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
    prompt = f"""
    Проаналізуй наступне рішення або дилему: "{query}"
    Надай структуровану відповідь українською мовою.
    
    ВІДПОВІДЬ МАЄ БУТИ ТІЛЬКИ В ФОРМАТІ JSON З ТАКОЮ СТРУКТУРОЮ:
    {{
      "prosCons": {{
        "pros": ["аргумент за 1", "аргумент за 2"],
        "cons": ["аргумент проти 1", "аргумент проти 2"]
      }},
      "swot": {{
        "strengths": ["сила 1"],
        "weaknesses": ["слабкість 1"],
        "opportunities": ["можливість 1"],
        "threats": ["ризик 1"]
      }},
      "summary": "Фінальна порада."
    }}
    """
    
    try:
        # Використовуємо простіший виклик без додаткових конфігів, 
        # які можуть викликати InvalidArgument в старих версіях SDK
        response = model.generate_content(prompt)
        
        if not response or not response.text:
            return None
            
        # Очищення від можливих markdown-тегів
        clean_text = re.sub(r'```json\s?|\s?```', '', response.text).strip()
        return json.loads(clean_text)
    except Exception as e:
        st.error(f"⚠️ Помилка Gemini API: {str(e)}")
        # Виводимо деталі в лог, якщо це можливо
        print(f"Full error: {e}")
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
