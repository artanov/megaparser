import json
import httpx


async def publish_post(
    channel_tg_id: str,
    text: str,
    media_paths: list[str],
    media_types: list[str],
    bot_token: str,
) -> None:
    base_url = f"https://api.telegram.org/bot{bot_token}"

    async with httpx.AsyncClient(timeout=60) as client:
        if not media_paths:
            await client.post(f"{base_url}/sendMessage", json={
                "chat_id": channel_tg_id,
                "text": text,
                "parse_mode": "Markdown",
            })

        elif len(media_paths) == 1:
            path = media_paths[0]
            type_ = media_types[0]
            method = "sendPhoto" if type_ == "photo" else "sendVideo"
            field = "photo" if type_ == "photo" else "video"

            with open(path, "rb") as f:
                await client.post(
                    f"{base_url}/{method}",
                    data={"chat_id": channel_tg_id, "caption": text, "parse_mode": "Markdown"},
                    files={field: f},
                )

        else:
            files = {}
            media_list = []

            for i, (path, type_) in enumerate(zip(media_paths, media_types)):
                field_name = f"file{i}"
                files[field_name] = open(path, "rb")
                item: dict = {"type": type_, "media": f"attach://{field_name}"}
                if i == 0:
                    item["caption"] = text
                    item["parse_mode"] = "Markdown"
                media_list.append(item)

            try:
                await client.post(
                    f"{base_url}/sendMediaGroup",
                    data={"chat_id": channel_tg_id, "media": json.dumps(media_list)},
                    files=files,
                )
            finally:
                for f in files.values():
                    f.close()
