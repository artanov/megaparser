from openai import AsyncOpenAI


DEFAULT_PROMPT = (
    "You are a copywriter for a Telegram channel. "
    "Rewrite the post in a fresh, engaging style. "
    "Preserve all facts. Return ONLY the rewritten text."
)


async def rewrite_post(text: str, api_key: str, prompt: str | None = None) -> str:
    client = AsyncOpenAI(api_key=api_key)

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": prompt or DEFAULT_PROMPT},
            {"role": "user", "content": text},
        ],
        max_tokens=1000,
    )

    return response.choices[0].message.content or ""
