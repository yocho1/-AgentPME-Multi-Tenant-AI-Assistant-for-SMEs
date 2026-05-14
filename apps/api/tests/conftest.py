"""
pytest configuration and fixtures.
"""

import pytest
import pytest_asyncio


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def sample_text():
    """Sample text for chunking tests."""
    return """
    This is a sample document for testing the chunking functionality.
    It contains multiple sentences that should be split into chunks.
    The chunking algorithm uses tiktoken for accurate token counting.
    Each chunk should be approximately 1000 tokens with 200 token overlap.
    This ensures that context is preserved across chunk boundaries.
    """ * 20  # Make it longer


@pytest.fixture
def sample_document_id():
    """Sample document ID."""
    return "test-doc-12345"
