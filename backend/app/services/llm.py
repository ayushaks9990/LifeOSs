import httpx

from ..config import settings


class LLMUnavailable(RuntimeError):
    pass


async def chat(messages: list[dict[str, str]], temperature: float = 0.35, max_tokens: int = 700) -> str:
    if not settings.llm_api_key:
        raise LLMUnavailable("LLM_API_KEY is not configured")
    url = f"{settings.llm_base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": settings.llm_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                url,
                headers={"Authorization": f"Bearer {settings.llm_api_key}", "Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"].strip()
            if not content:
                raise LLMUnavailable("The language model returned an empty response")
            return content
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        detail = str(exc)
        if isinstance(exc, httpx.HTTPStatusError):
            try:
                detail = exc.response.json().get("error", {}).get("message", detail)
            except ValueError:
                pass
        raise LLMUnavailable(f"Language model request failed: {detail}") from exc

