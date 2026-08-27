import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
import streamlit as st
from core.runs import list_runs, create_run
from core.config import format_date, translate
from core.ui import apply_global_styles, metric_card, section_header, status_badge
from core.loaders import load_table
from core.schema import CANONICAL_FIELDS, guess_mapping
from core.scraping_config import get_source_config
from core.presets import save_preset, list_presets, load_preset, get_last_preset

st.set_page_config(page_title="Lead Pipeline", page_icon="📊", layout="wide", initial_sidebar_state="collapsed")

if "language" not in st.session_state:
    st.session_state.language = "de"

apply_global_styles()

# ── Header ─────────────────────────────────────────────────────
st.markdown("""
<div class="app-header">
    <div class="tag-label">Lead Pipeline · Multi-Source Scraper</div>
    <h1 style="font-family:'Cormorant Garamond',serif!important;font-weight:300!important;font-size:clamp(28px,4vw,44px)!important;color:var(--ink)!important;margin:0 0 8px!important;">Lead <em style="font-style:italic;color:var(--gold-bright)!important;">Pipeline</em></h1>
    <p style="color:var(--ink-dim)!important;font-size:14px!important;margin:0!important;font-weight:300!important;">Scrape · Filter · Enrich · Export</p>
</div>
""", unsafe_allow_html=True)

lang_col1, lang_col2 = st.columns([6, 1])
with lang_col2:
    st.session_state.language = st.selectbox(
        "Lang", ["de", "en"], index=0 if st.session_state.language == "de" else 1,
        format_func=lambda x: "DE" if x == "de" else "EN",
        key="lang", label_visibility="collapsed",
    )

# ── New Run ───────────────────────────────────────────────────
st.markdown(section_header("01", "Neuer Run"), unsafe_allow_html=True)

source_options = {
    "phantombuster_linkedin": "PhantomBuster (LinkedIn)",
    "meta_ads_library": "Meta Ads Library",
    "job_portal": "Job Portal Scraper (coming soon)",
}

selected_source = st.selectbox(
    "Datenquelle", list(source_options.keys()),
    format_func=lambda k: source_options[k],
    key="source_select",
)


def render_source_form(source_key: str):
    """Dynamisches Formular basierend auf der Source-Config rendern."""
    config = get_source_config(source_key)
    if not config or source_key == "phantombuster_linkedin":
        return None

    fields = config.get("fields", [])
    if not fields:
        return None

    # Preset laden
    existing_presets = list_presets(source_key)
    last = get_last_preset(source_key)
    defaults = last or {}

    if existing_presets:
        preset_col1, preset_col2 = st.columns([2, 1])
        with preset_col1:
            selected_preset = st.selectbox(
                "Gespeicherte Config laden",
                ["— Neue Konfiguration —"] + existing_presets,
                key=f"preset_{source_key}",
            )
        if selected_preset != "— Neue Konfiguration —":
            loaded = load_preset(source_key, selected_preset)
            if loaded:
                defaults = loaded

    values = {}
    for field in fields:
        key = field["key"]
        ftype = field["type"]
        label = field.get("label", key)
        help_text = field.get("help", None)
        default = defaults.get(key, field.get("default", field.get("value")))

        if ftype == "text_area":
            val = st.text_area(
                label, value=default or "",
                placeholder=field.get("placeholder", ""),
                help=help_text, key=f"form_{source_key}_{key}",
                height=100,
            )
            values[key] = val

        elif ftype == "text":
            val = st.text_input(
                label, value=default or "",
                placeholder=field.get("placeholder", ""),
                help=help_text, key=f"form_{source_key}_{key}",
            )
            values[key] = val

        elif ftype == "number":
            val = st.number_input(
                label,
                value=default if default is not None else field.get("value", 1),
                min_value=field.get("min", 1),
                max_value=field.get("max", 1000),
                help=help_text, key=f"form_{source_key}_{key}",
            )
            values[key] = val

        elif ftype == "selectbox":
            options = field.get("options", [])
            default_val = default or field.get("default", options[0] if options else "")
            idx = options.index(default_val) if default_val in options else 0
            val = st.selectbox(
                label, options=options, index=idx,
                help=help_text, key=f"form_{source_key}_{key}",
            )
            values[key] = val

        elif ftype == "multiselect":
            options = field.get("options", [])
            default_list = default if isinstance(default, list) else field.get("default", [])
            val = st.multiselect(
                label, options=options, default=default_list,
                help=help_text, key=f"form_{source_key}_{key}",
            )
            values[key] = val

        elif ftype == "date":
            val = st.date_input(
                label, value=None,
                help=help_text, key=f"form_{source_key}_{key}",
            )
            values[key] = val

    return values


# ── Source-specific UI ────────────────────────────────────────
uploaded = None

if selected_source == "phantombuster_linkedin":
    upload_col, btn_col = st.columns([3, 1])
    with upload_col:
        uploaded = st.file_uploader(
            "CSV / XLSX hochladen", type=["csv", "xlsx", "xls"],
            key="home_uploader", label_visibility="collapsed",
        )
    with btn_col:
        test_btn = st.button("Testdaten", key="test_data_btn", use_container_width=True)

elif selected_source == "meta_ads_library":
    form_values = render_source_form(selected_source)

    if form_values:
        save_col, start_col = st.columns([1, 1])
        with save_col:
            preset_name = st.text_input(
                "Config speichern als",
                placeholder="z.B. AT_Coaches_Standard",
                key="preset_save_name",
                label_visibility="collapsed",
            )
            if preset_name and st.button("Config speichern", key="save_preset_btn", use_container_width=True):
                save_preset(selected_source, preset_name, form_values)
                st.rerun()

        with start_col:
            if st.button("Run starten", type="primary", use_container_width=True, key="start_meta_run"):
                from core.runs import save_raw_dataset, save_raw_mapping, save_run
                run = create_run(selected_source)
                run.scraper_config = form_values
                run.status = "dataset_ready"
                save_run(run)
                save_preset(selected_source, "_last", form_values)
                st.session_state["current_run_id"] = run.id
                st.markdown("""
                <div class="callout">
                    <div class="callout-title">Info</div>
                    <p>Meta Ads Library Scraper ist noch in Entwicklung. Die Konfiguration wurde gespeichert.</p>
                </div>
                """, unsafe_allow_html=True)

elif selected_source == "job_portal":
    st.markdown(
        '<div class="callout"><div class="callout-title">In Entwicklung</div>'
        '<p>Job Portal Scraper ist noch nicht verfügbar.</p></div>',
        unsafe_allow_html=True,
    )

# ── PhantomBuster: File Upload Flow ──────────────────────────
if selected_source == "phantombuster_linkedin" and uploaded:
    df = load_table(uploaded)
    if df is not None:
        st.markdown(
            f'<div class="helper-text"><span class="num" style="color:var(--gold-bright)!important;font-weight:500!important;">{len(df)}</span> Zeilen · '
            f'<span class="num" style="color:var(--gold-bright)!important;font-weight:500!important;">{len(df.columns)}</span> Spalten</div>',
            unsafe_allow_html=True,
        )

        with st.expander("Spaltenzuordnung & Vorschau", expanded=False):
            mapping = guess_mapping(list(df.columns), selected_source)
            cols = st.columns(len(CANONICAL_FIELDS))
            new_mapping = {}
            options = [""] + list(df.columns)
            for col, field in zip(cols, CANONICAL_FIELDS):
                with col:
                    current = mapping.get(field, "")
                    idx = options.index(current) if current in options else 0
                    new_mapping[field] = st.selectbox(field, options=options, index=idx, key=f"hmap_{field}")

            st.dataframe(df.head(5), use_container_width=True, height=200)

        if st.button("Run starten", type="primary", use_container_width=False, key="start_run"):
            from core.runs import save_raw_dataset, save_raw_mapping, save_run
            run = create_run(selected_source)
            raw_data = df.to_dict(orient="records")
            run.raw_dataset_file = save_raw_dataset(run.id, raw_data)
            run.raw_mapping_file = save_raw_mapping(run.id, new_mapping)
            run.status = "dataset_ready"
            save_run(run)
            st.session_state[f"run_{run.id}_df"] = df
            st.session_state[f"run_{run.id}_mapping"] = new_mapping
            st.session_state["current_run_id"] = run.id
            st.switch_page("pages/run_active.py")

# PhantomBuster: Test Data shortcut
if selected_source == "phantombuster_linkedin" and not uploaded:
    if "test_data_btn" in st.session_state and st.session_state.get("test_data_btn"):
        pass  # button handled below

    if st.session_state.get("test_data_btn"):
        from core.runs import save_raw_dataset, save_raw_mapping, save_run
        test_df = pd.DataFrame({
            "fullName": ["John Coach", "Sarah Fitness", "Mike Tech", "Emma Manifestation", "David B2B"],
            "companyName": ["High Ticket Academy", "Fit Pro Coaching", "Tech Startup Hub", "Manifestation Coaching", "Corporate Solutions"],
            "personalWebsite": ["https://highticket.com", "https://fitpro.de", "", "https://manifest.de", "https://b2bsolutions.de"],
            "linkedinHeadline": ["Business Coach", "Fitness Coach", "Tech Consultant", "Life Coach", "Business Development"],
            "linkedinDescription": ["I help entrepreneurs scale", "Personal training", "Building tech solutions", "Manifest your dreams", "Corporate strategy"],
        })
        mapping = guess_mapping(list(test_df.columns), selected_source)
        run = create_run(selected_source)
        run.raw_dataset_file = save_raw_dataset(run.id, test_df.to_dict(orient="records"))
        run.raw_mapping_file = save_raw_mapping(run.id, mapping)
        run.status = "dataset_ready"
        save_run(run)
        st.session_state[f"run_{run.id}_df"] = test_df
        st.session_state[f"run_{run.id}_mapping"] = mapping
        st.session_state["current_run_id"] = run.id
        st.switch_page("pages/run_active.py")

# ── Run History ───────────────────────────────────────────────
runs = list_runs()
if runs:
    st.markdown(section_header("02", "Letzte Runs"), unsafe_allow_html=True)

    for i, run in enumerate(runs[:15]):
        keep = ""
        if run.classification_results:
            k = sum(r.get("keep", 0) for r in run.classification_results.values())
            keep = str(k)

        rating_str = ""
        if run.rating:
            rating_str = f"{'★' * run.rating}{'☆' * (5 - run.rating)}"

        cols = st.columns([1.5, 1.8, 1, 0.8, 1, 1])

        with cols[0]:
            st.markdown(f'{status_badge(run.status)}', unsafe_allow_html=True)
        with cols[1]:
            st.markdown(
                f'<div style="font-size:13px;padding-top:0.2rem;color:var(--ink)!important;">{run.source.replace("_", " ").title()}</div>',
                unsafe_allow_html=True,
            )
        with cols[2]:
            st.markdown(
                f'<div class="num" style="font-size:12px;padding-top:0.3rem;color:var(--ink-faint)!important;">{format_date(run.created_at, "short")}</div>',
                unsafe_allow_html=True,
            )
        with cols[3]:
            if keep:
                st.markdown(
                    f'<div class="num" style="font-size:13px;color:var(--good)!important;font-weight:600;padding-top:0.3rem;">{keep}</div>',
                    unsafe_allow_html=True,
                )
        with cols[4]:
            if rating_str:
                st.markdown(
                    f'<div style="font-size:12px;color:var(--gold)!important;padding-top:0.3rem;">{rating_str}</div>',
                    unsafe_allow_html=True,
                )
        with cols[5]:
            if run.status == "completed":
                if st.button("Details", key=f"r_{run.id}", use_container_width=True):
                    st.session_state["view_run_id"] = run.id
                    st.switch_page("pages/run_history_detail.py")
            elif run.status in ("dataset_ready", "in_progress"):
                if st.button("Fortsetzen", key=f"r_{run.id}", use_container_width=True, type="primary"):
                    st.session_state["current_run_id"] = run.id
                    st.switch_page("pages/run_active.py")
