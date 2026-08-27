"""UI Components and Styling — dark theme with gold accents, matching reference design."""
import streamlit as st


def apply_global_styles():
    st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

        :root {
            --noir: #07070a;
            --panel: #0d0e13;
            --panel-2: #12141b;
            --panel-3: #171a22;
            --line: #23262f;
            --line-soft: #1a1d25;
            --gold: #c9a35f;
            --gold-bright: #e5c88b;
            --gold-dim: #8a6f3d;
            --ink: #e9e6df;
            --ink-dim: #9a978f;
            --ink-faint: #6a6862;
            --good: #6bb39a;
            --warn: #d9a441;
            --bad: #c9605a;
            --mono: 'JetBrains Mono', ui-monospace, monospace;
            --disp: 'Cormorant Garamond', Georgia, serif;
            --body: 'Inter', system-ui, sans-serif;
        }

        /* ── Reset & Foundation ──────────────────────────────── */
        #MainMenu, footer, header,
        [data-testid="stSidebarNav"],
        [data-testid="stSidebarCollapsedControl"],
        [data-testid="stStatusWidget"],
        .stDeployButton {
            display: none !important;
            visibility: hidden !important;
        }

        html, body, [data-testid="stAppViewContainer"],
        .main, [data-testid="stApp"] {
            background-color: var(--noir) !important;
            color: var(--ink) !important;
        }

        * {
            font-family: var(--body) !important;
            -webkit-font-smoothing: antialiased;
        }

        /* Noise overlay */
        [data-testid="stApp"]::before {
            content: '';
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 999;
            opacity: .035;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        [data-testid="stMainBlockContainer"] {
            padding: 2rem 2rem 4rem 2rem !important;
            max-width: 1180px !important;
            margin: 0 auto !important;
        }

        [data-testid="stSidebar"] {
            background-color: var(--panel) !important;
            border-right: 1px solid var(--line-soft) !important;
        }

        /* ── Typography ─────────────────────────────────────── */
        h1 {
            font-family: var(--disp) !important;
            font-weight: 300 !important;
            font-size: clamp(28px, 4vw, 44px) !important;
            line-height: 1.1 !important;
            letter-spacing: -0.01em !important;
            color: var(--ink) !important;
            margin-bottom: 0.25rem !important;
        }

        h2 {
            font-family: var(--disp) !important;
            font-weight: 400 !important;
            font-size: 26px !important;
            letter-spacing: 0.005em !important;
            color: var(--ink) !important;
            margin-top: 1.5rem !important;
            margin-bottom: 0.75rem !important;
        }

        h3 {
            font-family: var(--body) !important;
            font-weight: 600 !important;
            font-size: 13px !important;
            letter-spacing: 0.06em !important;
            text-transform: uppercase !important;
            color: var(--ink) !important;
            margin-top: 1rem !important;
            margin-bottom: 0.5rem !important;
        }

        p, li, span, label, div {
            color: var(--ink-dim) !important;
        }

        a {
            color: var(--gold-bright) !important;
            text-decoration: none !important;
        }

        /* ── Buttons ────────────────────────────────────────── */
        .stButton > button {
            font-family: var(--body) !important;
            border-radius: 8px !important;
            height: 40px !important;
            font-weight: 500 !important;
            font-size: 13px !important;
            letter-spacing: 0.02em !important;
            transition: all 0.2s ease !important;
            border: 1px solid var(--line) !important;
            background: var(--panel-2) !important;
            color: var(--ink) !important;
        }

        .stButton > button:hover {
            border-color: var(--gold-dim) !important;
            background: var(--panel-3) !important;
            color: var(--ink) !important;
        }

        .stButton > button[kind="primary"],
        .stButton > button[data-testid="stBaseButton-primary"] {
            background: linear-gradient(135deg, var(--gold), var(--gold-dim)) !important;
            color: var(--noir) !important;
            border-color: var(--gold) !important;
            font-weight: 600 !important;
        }

        .stButton > button[kind="primary"]:hover,
        .stButton > button[data-testid="stBaseButton-primary"]:hover {
            background: linear-gradient(135deg, var(--gold-bright), var(--gold)) !important;
            border-color: var(--gold-bright) !important;
        }

        /* ── Inputs & Selects ───────────────────────────────── */
        .stTextInput > div > div > input,
        .stTextArea > div > div > textarea,
        .stSelectbox > div > div,
        [data-baseweb="select"] > div {
            background: var(--panel-2) !important;
            border: 1px solid var(--line) !important;
            border-radius: 8px !important;
            color: var(--ink) !important;
            font-size: 13.5px !important;
        }

        .stTextInput > div > div > input:focus,
        .stTextArea > div > div > textarea:focus {
            border-color: var(--gold-dim) !important;
            box-shadow: 0 0 0 2px rgba(201, 163, 95, 0.12) !important;
        }

        [data-baseweb="select"] * {
            color: var(--ink) !important;
        }

        /* Dropdown menu */
        [data-baseweb="popover"],
        [data-baseweb="menu"],
        ul[role="listbox"] {
            background: var(--panel-2) !important;
            border: 1px solid var(--line) !important;
        }

        [data-baseweb="menu"] li,
        ul[role="listbox"] li {
            background: var(--panel-2) !important;
            color: var(--ink) !important;
        }

        [data-baseweb="menu"] li:hover,
        ul[role="listbox"] li:hover {
            background: var(--panel-3) !important;
        }

        /* Labels */
        .stSelectbox label,
        .stTextInput label,
        .stTextArea label,
        .stFileUploader label,
        .stSlider label,
        .stCheckbox label,
        .stRadio label {
            font-family: var(--mono) !important;
            font-size: 10px !important;
            letter-spacing: 0.18em !important;
            text-transform: uppercase !important;
            color: var(--ink-faint) !important;
            font-weight: 500 !important;
        }

        /* ── Tabs ───────────────────────────────────────────── */
        .stTabs [data-baseweb="tab-list"] {
            gap: 0 !important;
            border-bottom: 1px solid var(--line) !important;
            background: transparent !important;
        }

        .stTabs [data-baseweb="tab"] {
            font-family: var(--mono) !important;
            font-weight: 500 !important;
            font-size: 11px !important;
            letter-spacing: 0.1em !important;
            text-transform: uppercase !important;
            color: var(--ink-faint) !important;
            padding: 0.75rem 1.25rem !important;
            border-bottom: 2px solid transparent !important;
            background: transparent !important;
        }

        .stTabs [data-baseweb="tab"][aria-selected="true"] {
            color: var(--gold-bright) !important;
            font-weight: 600 !important;
            border-bottom-color: var(--gold) !important;
        }

        .stTabs [data-baseweb="tab-highlight"] {
            background-color: var(--gold) !important;
        }

        .stTabs [data-baseweb="tab-border"] {
            background-color: var(--line) !important;
        }

        /* ── Dividers ───────────────────────────────────────── */
        hr {
            margin: 1.5rem 0 !important;
            border: none !important;
            border-top: 1px solid var(--line) !important;
        }

        /* ── DataFrames ─────────────────────────────────────── */
        [data-testid="stDataFrame"] {
            border: 1px solid var(--line-soft) !important;
            border-radius: 10px !important;
            overflow: hidden !important;
        }

        [data-testid="stDataFrame"] * {
            color: var(--ink-dim) !important;
            font-size: 13px !important;
        }

        /* ── File Uploader ──────────────────────────────────── */
        [data-testid="stFileUploader"] {
            border-radius: 10px !important;
        }

        [data-testid="stFileUploader"] section {
            background: var(--panel) !important;
            border: 1px dashed var(--line) !important;
            border-radius: 10px !important;
            padding: 1.5rem !important;
        }

        [data-testid="stFileUploader"] section:hover {
            border-color: var(--gold-dim) !important;
        }

        [data-testid="stFileUploader"] button {
            background: var(--panel-2) !important;
            color: var(--gold-bright) !important;
            border: 1px solid var(--line) !important;
        }

        /* ── Expander ───────────────────────────────────────── */
        .streamlit-expanderHeader,
        [data-testid="stExpander"] summary {
            font-family: var(--body) !important;
            font-size: 13.5px !important;
            font-weight: 500 !important;
            color: var(--ink) !important;
            background: var(--panel) !important;
            border: 1px solid var(--line-soft) !important;
            border-radius: 10px !important;
        }

        [data-testid="stExpander"] {
            border: 1px solid var(--line-soft) !important;
            border-radius: 10px !important;
            background: var(--panel) !important;
        }

        [data-testid="stExpander"] [data-testid="stExpanderDetails"] {
            background: var(--panel) !important;
            border-top: 1px solid var(--line-soft) !important;
        }

        /* ── Alerts ─────────────────────────────────────────── */
        .stAlert, [data-testid="stAlert"] {
            background: var(--panel) !important;
            border: 1px solid var(--line-soft) !important;
            border-radius: 10px !important;
            color: var(--ink-dim) !important;
            font-size: 13.5px !important;
        }

        [data-testid="stAlert"] p {
            color: var(--ink-dim) !important;
        }

        /* ── Progress Bar ───────────────────────────────────── */
        .stProgress > div > div {
            background-color: var(--panel-2) !important;
        }

        .stProgress > div > div > div {
            background: linear-gradient(90deg, var(--gold-dim), var(--gold)) !important;
        }

        /* ── Slider ─────────────────────────────────────────── */
        [data-testid="stSlider"] > div > div {
            color: var(--ink) !important;
        }

        [data-baseweb="slider"] [role="slider"] {
            background: var(--gold) !important;
            border-color: var(--gold) !important;
        }

        /* ── Checkbox ───────────────────────────────────────── */
        .stCheckbox span {
            color: var(--ink-dim) !important;
            font-size: 13.5px !important;
        }

        /* ── Download Button ────────────────────────────────── */
        .stDownloadButton > button {
            background: var(--panel-2) !important;
            color: var(--gold-bright) !important;
            border: 1px solid var(--gold-dim) !important;
            border-radius: 8px !important;
            font-weight: 500 !important;
        }

        .stDownloadButton > button:hover {
            background: var(--panel-3) !important;
            border-color: var(--gold) !important;
        }

        /* ── Scrollbar ──────────────────────────────────────── */
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        ::-webkit-scrollbar-track {
            background: var(--noir);
        }

        ::-webkit-scrollbar-thumb {
            background: var(--line);
            border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--ink-faint);
        }

        /* ===================================================
           CUSTOM COMPONENT CLASSES
           =================================================== */

        .tag-label {
            font-family: 'JetBrains Mono', monospace !important;
            font-size: 10.5px !important;
            letter-spacing: 0.26em !important;
            text-transform: uppercase !important;
            color: var(--gold) !important;
            margin-bottom: 12px !important;
        }

        .sec-head {
            display: flex;
            align-items: baseline;
            gap: 16px;
            margin-bottom: 20px;
        }

        .sec-head .idx {
            font-family: 'JetBrains Mono', monospace !important;
            font-size: 11px;
            color: var(--gold);
            letter-spacing: 0.14em;
        }

        .sec-head h2 {
            font-family: 'Cormorant Garamond', serif !important;
            font-weight: 400 !important;
            font-size: 26px !important;
            margin: 0 !important;
        }

        .sec-head .rule {
            flex: 1;
            height: 1px;
            background: linear-gradient(90deg, var(--line) 0%, transparent 100%);
        }

        .helper-text {
            font-size: 13px !important;
            color: var(--ink-dim) !important;
            line-height: 1.55 !important;
        }

        /* ── KPI Cards ──────────────────────────────────────── */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 16px;
            margin: 8px 0 16px;
        }

        .kpi {
            background: var(--panel);
            border: 1px solid var(--line-soft);
            border-radius: 12px;
            padding: 22px 22px 20px;
            position: relative;
            overflow: hidden;
        }

        .kpi::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 2px;
        }

        .kpi.gold::before { background: var(--gold); }
        .kpi.good::before { background: var(--good); }
        .kpi.bad::before { background: var(--bad); }
        .kpi.warn::before { background: var(--warn); }
        .kpi.faint::before { background: var(--ink-faint); }

        .kpi .kpi-label {
            font-family: 'JetBrains Mono', monospace !important;
            font-size: 9.5px !important;
            letter-spacing: 0.2em !important;
            text-transform: uppercase !important;
            color: var(--ink-faint) !important;
            margin-bottom: 12px !important;
        }

        .kpi .kpi-value {
            font-family: 'Cormorant Garamond', serif !important;
            font-size: 40px !important;
            line-height: 1 !important;
            font-weight: 400 !important;
            color: var(--ink) !important;
            letter-spacing: -0.01em !important;
        }

        .kpi .kpi-value.sm {
            font-size: 28px !important;
        }

        .kpi .kpi-sub {
            font-size: 12.5px !important;
            color: var(--ink-dim) !important;
            margin-top: 10px !important;
        }

        .kpi .kpi-sub b {
            color: var(--gold-bright) !important;
            font-weight: 500 !important;
        }

        /* ── Status Badges ──────────────────────────────────── */
        .status-badge {
            display: inline-block;
            font-family: 'JetBrains Mono', monospace !important;
            font-size: 9px !important;
            letter-spacing: 0.14em !important;
            text-transform: uppercase !important;
            padding: 3px 8px !important;
            border-radius: 4px !important;
            border: 1px solid !important;
        }

        .status-badge.draft {
            color: var(--ink-faint) !important;
            border-color: rgba(106, 104, 98, 0.35) !important;
            background: rgba(106, 104, 98, 0.07) !important;
        }

        .status-badge.scraping,
        .status-badge.in_progress {
            color: var(--warn) !important;
            border-color: rgba(217, 164, 65, 0.35) !important;
            background: rgba(217, 164, 65, 0.07) !important;
        }

        .status-badge.dataset_ready {
            color: var(--gold-bright) !important;
            border-color: rgba(201, 163, 95, 0.35) !important;
            background: rgba(201, 163, 95, 0.07) !important;
        }

        .status-badge.completed {
            color: var(--good) !important;
            border-color: rgba(107, 179, 154, 0.35) !important;
            background: rgba(107, 179, 154, 0.07) !important;
        }

        /* ── Panel Cards ────────────────────────────────────── */
        .panel {
            background: var(--panel);
            border: 1px solid var(--line-soft);
            border-radius: 12px;
            padding: 24px 26px;
        }

        .panel-2 {
            background: var(--panel-2);
            border: 1px solid var(--line-soft);
            border-radius: 10px;
            padding: 16px 18px;
        }

        /* ── Run History Rows ───────────────────────────────── */
        .run-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13.5px;
        }

        .run-table th {
            font-family: 'JetBrains Mono', monospace !important;
            font-size: 9.5px !important;
            letter-spacing: 0.14em !important;
            text-transform: uppercase !important;
            color: var(--ink-faint) !important;
            text-align: left !important;
            padding: 0 10px 10px !important;
            border-bottom: 1px solid var(--line) !important;
            font-weight: 500 !important;
        }

        .run-table td {
            padding: 11px 10px !important;
            border-bottom: 1px solid var(--line-soft) !important;
            vertical-align: middle !important;
            font-size: 13px !important;
            color: var(--ink-dim) !important;
        }

        .run-table tr:last-child td {
            border-bottom: none !important;
        }

        .run-table tr:hover td {
            background: rgba(255, 255, 255, 0.014) !important;
        }

        .num {
            font-family: 'JetBrains Mono', monospace !important;
            font-variant-numeric: tabular-nums !important;
        }

        /* ── Callout ────────────────────────────────────────── */
        .callout {
            background: var(--panel);
            border: 1px solid var(--line-soft);
            border-left: 2px solid var(--gold);
            border-radius: 0 10px 10px 0;
            padding: 20px 24px;
            margin: 16px 0;
        }

        .callout.warn { border-left-color: var(--warn); }
        .callout.bad { border-left-color: var(--bad); }
        .callout.good { border-left-color: var(--good); }

        .callout .callout-title {
            font-family: 'JetBrains Mono', monospace !important;
            font-size: 10px !important;
            letter-spacing: 0.18em !important;
            text-transform: uppercase !important;
            color: var(--gold) !important;
            margin-bottom: 9px !important;
        }

        .callout p {
            margin: 0 0 10px !important;
            font-size: 13.5px !important;
            color: var(--ink-dim) !important;
            line-height: 1.62 !important;
        }

        .callout b {
            color: var(--ink) !important;
            font-weight: 600 !important;
        }

        /* ── Header Banner ──────────────────────────────────── */
        .app-header {
            margin: 16px 0 32px;
            padding: 28px 0 24px;
            border-top: 1px solid var(--gold-dim);
            border-bottom: 1px solid var(--line);
            position: relative;
        }

        .app-header::after {
            content: '';
            position: absolute;
            left: 0;
            top: -1px;
            width: 130px;
            height: 2px;
            background: var(--gold);
        }
    </style>
    """, unsafe_allow_html=True)


def section_header(index: str, title: str) -> str:
    return f"""
    <div class="sec-head">
        <span class="idx">{index}</span>
        <h2 style="font-family:'Cormorant Garamond',serif!important;font-weight:400!important;font-size:26px!important;margin:0!important;color:var(--ink)!important;">{title}</h2>
        <span class="rule"></span>
    </div>
    """


def status_badge(status: str) -> str:
    labels = {
        "draft": "Entwurf",
        "scraping": "Scraping",
        "dataset_ready": "Bereit",
        "in_progress": "In Bearbeitung",
        "completed": "Abgeschlossen",
    }
    label = labels.get(status, status)
    return f'<span class="status-badge {status}">{label}</span>'


def metric_card(label: str, value, accent: str = "gold") -> str:
    return f"""
    <div class="kpi {accent}">
        <div class="kpi-label">{label}</div>
        <div class="kpi-value">{value}</div>
    </div>
    """


def metric_card_with_sub(label: str, value, sub: str = "", accent: str = "gold") -> str:
    sub_html = f'<div class="kpi-sub">{sub}</div>' if sub else ""
    return f"""
    <div class="kpi {accent}">
        <div class="kpi-label">{label}</div>
        <div class="kpi-value">{value}</div>
        {sub_html}
    </div>
    """
