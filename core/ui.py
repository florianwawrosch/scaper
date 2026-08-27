"""UI Components and Styling — clean, professional, Hiros-inspired."""
import streamlit as st


def apply_global_styles():
    """Apply consistent styling across the app."""
    st.markdown("""
    <style>
        /* =============================
           RESET & FOUNDATION
           ============================= */

        /* Remove default Streamlit header/footer/hamburger */
        #MainMenu, footer, header {
            visibility: hidden !important;
        }

        /* Remove Streamlit's built-in sidebar page navigation */
        [data-testid="stSidebarNav"] {
            display: none !important;
        }

        /* System font stack */
        * {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue",
                Arial, sans-serif !important;
        }

        /* Main container */
        [data-testid="stMainBlockContainer"] {
            padding: 2rem 3rem 4rem 3rem;
            max-width: 1100px;
            margin: 0 auto;
        }

        /* =============================
           TYPOGRAPHY
           ============================= */
        h1 {
            font-size: 1.75rem !important;
            font-weight: 700 !important;
            letter-spacing: -0.03em !important;
            color: #111827 !important;
            margin-bottom: 0.25rem !important;
        }

        h2 {
            font-size: 1.25rem !important;
            font-weight: 600 !important;
            letter-spacing: -0.02em !important;
            color: #111827 !important;
            margin-top: 2rem !important;
            margin-bottom: 0.75rem !important;
        }

        h3 {
            font-size: 1rem !important;
            font-weight: 600 !important;
            color: #374151 !important;
            margin-top: 1.25rem !important;
            margin-bottom: 0.5rem !important;
        }

        p, li, td, th, span, label, div {
            color: #374151;
        }

        /* =============================
           BUTTONS
           ============================= */
        .stButton > button {
            border-radius: 8px !important;
            height: 42px !important;
            font-weight: 600 !important;
            font-size: 0.9rem !important;
            letter-spacing: -0.01em !important;
            transition: all 0.15s ease !important;
            border: 1px solid #d1d5db !important;
            background: #ffffff !important;
            color: #374151 !important;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
        }

        .stButton > button:hover {
            border-color: #9ca3af !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
        }

        .stButton > button[kind="primary"] {
            background: #10b981 !important;
            color: #ffffff !important;
            border-color: #10b981 !important;
            box-shadow: 0 1px 3px rgba(16, 185, 129, 0.3) !important;
        }

        .stButton > button[kind="primary"]:hover {
            background: #059669 !important;
            border-color: #059669 !important;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4) !important;
        }

        /* =============================
           INPUTS
           ============================= */
        .stTextInput > div > div > input,
        .stTextArea > div > div > textarea {
            border-radius: 8px !important;
            border: 1px solid #d1d5db !important;
            font-size: 0.9rem !important;
            transition: border-color 0.15s !important;
        }

        .stTextInput > div > div > input:focus,
        .stTextArea > div > div > textarea:focus {
            border-color: #10b981 !important;
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.08) !important;
        }

        /* =============================
           TABS
           ============================= */
        .stTabs [data-baseweb="tab-list"] {
            gap: 0 !important;
            border-bottom: 1px solid #e5e7eb !important;
            background: transparent !important;
        }

        .stTabs [data-baseweb="tab"] {
            font-weight: 500 !important;
            font-size: 0.9rem !important;
            color: #6b7280 !important;
            padding: 0.75rem 1.25rem !important;
            border-bottom: 2px solid transparent !important;
            background: transparent !important;
        }

        .stTabs [data-baseweb="tab"][aria-selected="true"] {
            color: #111827 !important;
            font-weight: 600 !important;
            border-bottom-color: #10b981 !important;
        }

        /* =============================
           DIVIDERS
           ============================= */
        hr {
            margin: 1.75rem 0 !important;
            border: none !important;
            border-top: 1px solid #e5e7eb !important;
        }

        /* =============================
           DATAFRAMES
           ============================= */
        [data-testid="stDataFrame"] {
            border: 1px solid #e5e7eb !important;
            border-radius: 8px !important;
            overflow: hidden !important;
        }

        /* =============================
           FILE UPLOADER
           ============================= */
        [data-testid="stFileUploader"] {
            border-radius: 8px !important;
        }

        /* =============================
           EXPANDER
           ============================= */
        .streamlit-expanderHeader {
            font-size: 0.9rem !important;
            font-weight: 500 !important;
            color: #374151 !important;
        }

        /* =============================
           SUCCESS / ERROR / INFO
           ============================= */
        .stSuccess, .stError, .stInfo, .stWarning {
            border-radius: 8px !important;
            font-size: 0.9rem !important;
        }

        /* =============================
           SIDEBAR (still exists for settings)
           ============================= */
        [data-testid="stSidebar"] {
            background-color: #f9fafb;
            border-right: 1px solid #e5e7eb;
        }

        /* =============================
           CUSTOM CLASSES
           ============================= */
        .helper-text {
            font-size: 0.85rem;
            color: #6b7280;
            line-height: 1.5;
            margin-top: 0.25rem;
        }

        .subtitle {
            color: #6b7280;
            font-size: 0.95rem;
            margin-bottom: 1.5rem;
            line-height: 1.5;
        }

        .source-card {
            padding: 1.75rem;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            background: #ffffff;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .source-card:hover {
            border-color: #10b981;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.08);
        }

        .source-card h4 {
            font-size: 1.1rem !important;
            font-weight: 600 !important;
            color: #111827 !important;
            margin: 0 0 0.5rem 0 !important;
        }

        .source-card p {
            color: #6b7280;
            font-size: 0.9rem;
            line-height: 1.6;
            margin: 0;
        }

        .run-row {
            display: flex;
            align-items: center;
            padding: 1rem 0;
        }

        .run-row .run-title {
            font-weight: 600;
            font-size: 0.95rem;
            color: #111827;
        }

        .run-row .run-meta {
            color: #6b7280;
            font-size: 0.85rem;
            margin-top: 0.15rem;
        }

        .status-badge {
            display: inline-block;
            padding: 0.2rem 0.6rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 600;
            letter-spacing: 0.02em;
        }

        .status-badge.draft { background: #f3f4f6; color: #4b5563; }
        .status-badge.scraping { background: #fef3c7; color: #92400e; }
        .status-badge.dataset_ready { background: #dbeafe; color: #1e40af; }
        .status-badge.in_progress { background: #fef3c7; color: #92400e; }
        .status-badge.completed { background: #d1fae5; color: #065f46; }
    </style>
    """, unsafe_allow_html=True)


def status_badge(status: str) -> str:
    """Generate a styled status badge HTML."""
    labels = {
        "draft": "Draft",
        "scraping": "Scraping",
        "dataset_ready": "Dataset bereit",
        "in_progress": "In Bearbeitung",
        "completed": "Abgeschlossen",
    }
    label = labels.get(status, status)
    return f'<span class="status-badge {status}">{label}</span>'


def metric_card(label: str, value, color: str = "#10b981") -> str:
    """Generate a styled metric card HTML."""
    return f"""
    <div style="text-align: center; padding: 1.25rem; background: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb;">
        <div style="font-size: 2rem; font-weight: 700; color: {color}; line-height: 1;">{value}</div>
        <div style="font-size: 0.8rem; color: #6b7280; font-weight: 500; margin-top: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">{label}</div>
    </div>
    """
