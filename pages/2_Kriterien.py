import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st

from core import criteria_store

st.set_page_config(page_title="Kriterien verwalten", page_icon="⚙️", layout="wide")
st.title("Filterkriterien verwalten")
st.caption(
    "Hier koennen neue Ausschlussmuster ergaenzt werden, sobald beim Durchsehen neue "
    "'Fehlläufer' auffallen -- ohne Code zu aendern."
)

sources = criteria_store.list_sources()
source_labels = {
    "meta_ads_library": "Meta Ads Library",
    "phantombuster_linkedin": "PhantomBuster / LinkedIn",
}
source = st.selectbox("Quelle", options=sources, format_func=lambda s: source_labels.get(s, s))

data = criteria_store.load_criteria(source)

st.subheader("Zielprofil (wen wir behalten wollen)")
target_profile = st.text_area("Zielprofil", value=data.get("target_profile", ""), height=100, label_visibility="collapsed")
if target_profile != data.get("target_profile", ""):
    data["target_profile"] = target_profile
    criteria_store.save_criteria(source, data)
    st.toast("Zielprofil gespeichert.")

st.subheader("Ausschlussregeln")
for rule in list(data.get("exclusion_rules", [])):
    with st.container(border=True):
        c1, c2 = st.columns([5, 1])
        with c1:
            label = st.text_input("Bezeichnung", value=rule["label"], key=f"label_{rule['id']}")
            desc = st.text_area("Beschreibung", value=rule["description"], key=f"desc_{rule['id']}", height=80)
            active = st.checkbox("aktiv", value=rule.get("active", True), key=f"active_{rule['id']}")
        with c2:
            if st.button("Speichern", key=f"save_{rule['id']}"):
                criteria_store.update_rule(source, rule["id"], label=label, description=desc, active=active)
                st.rerun()
            if st.button("Loeschen", key=f"del_{rule['id']}"):
                criteria_store.delete_rule(source, rule["id"])
                st.rerun()

st.subheader("Neue Regel hinzufuegen")
with st.form("new_rule"):
    new_label = st.text_input("Bezeichnung (kurz)")
    new_desc = st.text_area("Beschreibung -- wann soll diese Regel greifen?")
    submitted = st.form_submit_button("Regel hinzufuegen")
    if submitted and new_label and new_desc:
        criteria_store.add_rule(source, new_label, new_desc)
        st.success("Regel hinzugefuegt.")
        st.rerun()

with st.expander("Notizen"):
    notes_text = st.text_area("Freie Notizen", value="\n".join(data.get("notes", [])), height=100)
    if st.button("Notizen speichern"):
        data = criteria_store.load_criteria(source)
        data["notes"] = [n for n in notes_text.splitlines() if n.strip()]
        criteria_store.save_criteria(source, data)
        st.success("Gespeichert.")
