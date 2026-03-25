import asyncio
import logging
import sys

from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_core.models import UserMessage

logging.basicConfig(level=logging.DEBUG)

async def main():
    try:
        client = OpenAIChatCompletionClient(
            model="gemini-1.5-flash",
            api_key="AIzaSyBqssX6l1-xziA3-M2ETjeKmlqPsgkJgpI",
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            model_info={
                "vision": True,
                "function_calling": True,
                "json_output": True,
                "family": "gemini",
                "structured_output": False
            }
        )
        print("Sending message...")
        response = await client.create([UserMessage(content="What is the capital of France?", source="user")])
        print("Response:", response)
    except Exception as e:
        print("ERROR OCCURRED:", type(e).__name__, str(e))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
