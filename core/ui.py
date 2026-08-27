"""UI Components and Styling - Inspired by Claude Chat design."""
import streamlit as st


def apply_global_styles():
    """Apply consistent styling across the app - Claude Chat inspired."""
    st.markdown("""
    <style>
        /* Typography & Spacing */
        * {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen",
                "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue",
                sans-serif !important;
        }

        /* Main container padding */
        [data-testid="stMainBlockContainer"] {
            padding-top: 1.5rem;
            padding-left: 2rem;
            padding-right: 2rem;
            padding-bottom: 2rem;
        }

        /* Headings */
        h1 {
            font-size: 2rem !important;
            font-weight: 600 !important;
            letter-spacing: -0.02em !important;
            margin-bottom: 0.5rem !important;
            color: #000 !important;
        }

        h2 {
            font-size: 1.3rem !important;
            font-weight: 600 !important;
            letter-spacing: -0.01em !important;
            margin-top: 1.5rem !important;
            margin-bottom: 1rem !important;
            color: #111 !important;
        }

        h3 {
            font-size: 1rem !important;
            font-weight: 600 !important;
            margin-top: 1rem !important;
            margin-bottom: 0.75rem !important;
            color: #1a1a1a !important;
        }

        p {
            line-height: 1.6;
            color: #424242;
        }

        /* Buttons */
        .stButton > button {
            border-radius: 8px !important;
            height: 40px !important;
            font-weight: 500 !important;
            font-size: 0.95rem !important;
            transition: all 0.2s ease !important;
            border: none !important;
        }

        .stButton > button:hover {
            transform: translateY(-1px) !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
        }

        /* Primary button */
        .stButton > button[kind="primary"] {
            background-color: #10b981 !important;
            color: white !important;
        }

        .stButton > button[kind="primary"]:hover {
            background-color: #059669 !important;
        }

        /* Cards & Containers */
        .card {
            padding: 1.5rem;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #fff;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            transition: all 0.2s ease;
        }

        .card:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border-color: #d1d5db;
        }

        /* Input fields */
        .stTextInput > div > div > input,
        .stTextArea > div > div > textarea,
        .stSelectbox > div > div > select,
        .stMultiSelect > div > div > div {
            border-radius: 6px !important;
            border: 1px solid #d1d5db !important;
            padding: 0.75rem !important;
            font-size: 0.95rem !important;
            transition: all 0.2s ease !important;
        }

        .stTextInput > div > div > input:focus,
        .stTextArea > div > div > textarea:focus,
        .stSelectbox > div > div > select:focus {
            border-color: #10b981 !important;
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1) !important;
        }

        /* Divider */
        hr {
            margin: 1.5rem 0 !important;
            border: none !important;
            border-top: 1px solid #e5e7eb !important;
        }

        /* Tabs */
        .stTabs > [data-baseweb="tab-list"] {
            gap: 0.5rem;
            border-bottom: 1px solid #e5e7eb !important;
        }

        .stTabs > [data-baseweb="tab-list"] > button {
            font-weight: 500 !important;
            padding: 0.75rem 1rem !important;
            color: #6b7280 !important;
            border-bottom: 2px solid transparent !important;
            transition: all 0.2s ease !important;
        }

        .stTabs > [data-baseweb="tab-list"] > button[aria-selected="true"] {
            color: #000 !important;
            border-bottom-color: #10b981 !important;
        }

        /* Metrics display */
        .metric-box {
            text-align: center;
            padding: 1.5rem;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
        }

        .metric-value {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }

        .metric-label {
            font-size: 0.85rem;
            color: #6b7280;
            font-weight: 500;
        }

        /* Success/Error messages */
        .stSuccess, .stError, .stInfo, .stWarning {
            border-radius: 6px !important;
            padding: 1rem !important;
            font-size: 0.95rem !important;
        }

        /* Dataframe styling */
        [role="table"] {
            border-radius: 6px !important;
            overflow: hidden;
        }

        /* Sidebar */
        [data-testid="stSidebar"] {
            background-color: #f9fafb;
            border-right: 1px solid #e5e7eb;
        }

        /* Helper text */
        .helper-text {
            font-size: 0.85rem;
            color: #6b7280;
            margin-top: 0.25rem;
        }

        /* Status badge */
        .status-badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .status-badge.draft {
            background-color: #f3f4f6;
            color: #4b5563;
        }

        .status-badge.in_progress {
            background-color: #fef3c7;
            color: #92400e;
        }

        .status-badge.completed {
            background-color: #d1fae5;
            color: #065f46;
        }
    </style>
    """, unsafe_allow_html=True)


def status_badge(status: str) -> str:
    """Generate a styled status badge HTML."""
    status_labels = {
        "draft": "Draft",
        "in_progress": "In Progress",
        "scraping": "Scraping",
        "dataset_ready": "Ready",
        "completed": "Completed",
    }

    label = status_labels.get(status, status)
    return f'<span class="status-badge {status}">{label}</span>'


def metric_card(label: str, value, color: str = "#10b981") -> str:
    """Generate a styled metric card HTML."""
    return f"""
    <div class="metric-box">
        <div class="metric-value" style="color: {color};">{value}</div>
        <div class="metric-label">{label}</div>
    </div>
    """


def info_box(title: str, description: str, icon: str = "ℹ️") -> str:
    """Generate an info box."""
    return f"""
    <div style="padding: 1rem; background: #f0f9ff; border-left: 4px solid #0284c7; border-radius: 4px; margin: 1rem 0;">
        <div style="font-weight: 600; color: #0c4a6e; margin-bottom: 0.25rem;">{icon} {title}</div>
        <div style="color: #164e63; font-size: 0.9rem;">{description}</div>
    </div>
    """
