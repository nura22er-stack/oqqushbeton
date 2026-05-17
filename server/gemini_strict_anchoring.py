from __future__ import annotations

import json
from typing import Iterable


DEFAULT_MODEL = "models/gemini-1.5-flash"

SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
]


def normalize_keywords(panel_keywords: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for keyword in panel_keywords:
        value = " ".join(str(keyword).strip().split())
        if len(value) < 2:
            continue
        lowered = value.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        normalized.append(value)
    return normalized


def build_system_instruction(panel_keywords: Iterable[str]) -> str:
    keywords = normalize_keywords(panel_keywords)
    keyword_text = ", ".join(keywords) if keywords else "kalit so'z topilmadi"
    return f"""
Siz Oqqush Beton saytining AI yordamchisisiz.

STRICT ANCHORING QOIDASI:
Siz faqat quyidagi kalit so'zlar va ularga tegishli bo'lim/panellar doirasida javob berasiz:
{keyword_text}

Qoidalar:
1. Faqat yuqoridagi kalit so'zlarga tayangan holda javob bering.
2. Agar foydalanuvchi "bo'limni och" desa, faqat tegishli bo'limni ochish buyrug'ini qaytaring.
3. Agar foydalanuvchi "ma'lumot ber" desa, faqat shu bo'lim yoki panelning o'ziga tegishli ma'lumotni ayting.
4. Agar foydalanuvchi so'rovi kalit so'zlarga mos kelmasa, uni eng yaqin mavjud kalitga bog'lashga urinib ko'ring, lekin yangi fakt o'ylab topmang.
5. Agar bog'lab bo'lmasa, aniq shunday javob bering: "Bu ma'lumot Oqqush Beton ma'lumotlarida ko'rsatilmagan".
6. Narx, kafolat, texnik ko'rsatkich yoki saytda yo'q bo'lgan ma'lumotni qo'shmang.
7. Javobni o'zbek tilida, qisqa va aniq bering.
""".strip()


def build_multimodal_user_parts(user_input: str, panel_keywords: Iterable[str]) -> list[dict]:
    keywords = normalize_keywords(panel_keywords)
    return [
        {"text": user_input},
        {
            "text": (
                "STRICT_ANCHOR_KEYWORDS_JSON: "
                + json.dumps(keywords, ensure_ascii=False)
            )
        },
    ]


def build_generate_content_payload(user_input: str, panel_keywords: Iterable[str]) -> dict:
    return {
        "model": DEFAULT_MODEL,
        "system_instruction": {
            "parts": [
                {
                    "text": build_system_instruction(panel_keywords),
                }
            ]
        },
        "contents": [
            {
                "role": "user",
                "parts": build_multimodal_user_parts(user_input, panel_keywords),
            }
        ],
        "generation_config": {
            "temperature": 0.1,
            "top_p": 0.2,
            "max_output_tokens": 256,
        },
        "safety_settings": SAFETY_SETTINGS,
    }
