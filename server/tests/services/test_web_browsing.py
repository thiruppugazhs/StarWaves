import unittest
from unittest.mock import MagicMock, patch

from app.services.web_browsing import (
    browse_web,
    fetch_web_page,
    search_web,
    _clean_text,
    _extract_target_url,
)
from app.services.eve import dispatch_tool


class TestWebBrowsing(unittest.TestCase):
    def test_clean_text(self):
        self.assertEqual(_clean_text("  hello   world  \n\n\n\n test  "), "hello world\n\ntest")
        self.assertEqual(_clean_text(""), "")

    def test_extract_target_url(self):
        direct = "https://example.com/article"
        self.assertEqual(_extract_target_url(direct), direct)

        ddg_redirect = "//duckduckgo.com/l/?uddg=https%3A%2F%2Fpython.org%2Fnews&rut=123"
        self.assertEqual(_extract_target_url(ddg_redirect), "https://python.org/news")

    def test_search_web_empty_query(self):
        with self.assertRaises(ValueError):
            search_web("")

    @patch("httpx.Client.post")
    def test_search_web_html_success(self, mock_post):
        mock_html = """
        <html>
            <body>
                <div class="result">
                    <h2 class="result__title">
                        <a class="result__url" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fstarwaves.app&rut=1">StarWaves Dashboard</a>
                    </h2>
                    <div class="result__snippet">The all-in-one productivity workspace.</div>
                </div>
            </body>
        </html>
        """
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = mock_html
        mock_post.return_value = mock_response

        res = search_web("starwaves productivity", num_results=3)
        self.assertEqual(res["query"], "starwaves productivity")
        self.assertEqual(len(res["results"]), 1)
        self.assertEqual(res["results"][0]["title"], "StarWaves Dashboard")
        self.assertEqual(res["results"][0]["url"], "https://starwaves.app")
        self.assertIn("productivity workspace", res["results"][0]["snippet"])

    @patch("httpx.Client.post")
    @patch("httpx.Client.get")
    def test_search_web_api_fallback(self, mock_get, mock_post):
        # HTML fails or returns empty
        empty_resp = MagicMock()
        empty_resp.status_code = 200
        empty_resp.text = "<html><body>No results</body></html>"
        mock_post.return_value = empty_resp

        # API returns data
        api_resp = MagicMock()
        api_resp.status_code = 200
        api_resp.json.return_value = {
            "Heading": "Python (programming language)",
            "AbstractText": "Python is a high-level programming language.",
            "AbstractURL": "https://en.wikipedia.org/wiki/Python_(programming_language)",
            "RelatedTopics": [
                {
                    "Text": "Python Software Foundation - Official non-profit",
                    "FirstURL": "https://www.python.org/psf/",
                }
            ],
        }
        mock_get.return_value = api_resp

        res = search_web("python", num_results=5)
        self.assertEqual(len(res["results"]), 2)
        self.assertEqual(res["results"][0]["title"], "Python (programming language)")
        self.assertEqual(res["results"][0]["url"], "https://en.wikipedia.org/wiki/Python_(programming_language)")

    def test_fetch_web_page_invalid_url(self):
        with self.assertRaises(ValueError):
            fetch_web_page("")
        with self.assertRaises(ValueError):
            fetch_web_page("not a url at all ::::")

    @patch("app.services.web_browsing._assert_public_url")
    @patch("httpx.Client.get")
    def test_fetch_web_page_html(self, mock_get, mock_assert):
        html_content = """
        <!DOCTYPE html>
        <html>
            <head>
                <title>Test Page Title</title>
                <meta name="description" content="A test page description" />
                <style>body { color: red; }</style>
                <script>console.log("secret script");</script>
            </head>
            <body>
                <nav>Navigation links to remove</nav>
                <main>
                    <h1>Main Headline</h1>
                    <p>This is the first paragraph with important text.</p>
                    <h2>Subheading</h2>
                    <ul>
                        <li>Feature 1</li>
                        <li>Feature 2</li>
                    </ul>
                </main>
                <footer>Footer links to remove</footer>
            </body>
        </html>
        """
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = html_content
        mock_response.url = "https://example.com/test-page"
        mock_response.headers = {"content-type": "text/html; charset=utf-8"}
        mock_get.return_value = mock_response

        data = fetch_web_page("https://example.com/test-page")
        self.assertEqual(data["title"], "Test Page Title")
        self.assertEqual(data["description"], "A test page description")
        self.assertIn("# Main Headline", data["content"])
        self.assertIn("This is the first paragraph", data["content"])
        self.assertIn("- Feature 1", data["content"])
        self.assertNotIn("secret script", data["content"])
        self.assertNotIn("Navigation links", data["content"])
        self.assertNotIn("Footer links", data["content"])

    @patch("app.services.web_browsing._assert_public_url")
    @patch("httpx.Client.get")
    def test_fetch_web_page_json(self, mock_get, mock_assert):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '{"status": "ok", "items": [1, 2, 3]}'
        mock_response.url = "https://api.example.com/data"
        mock_response.headers = {"content-type": "application/json"}
        mock_get.return_value = mock_response

        data = fetch_web_page("https://api.example.com/data")
        self.assertEqual(data["title"], "JSON Document")
        self.assertIn('"status": "ok"', data["content"])

    def test_browse_web_no_query_or_url(self):
        with self.assertRaises(ValueError):
            browse_web()

    @patch("app.services.web_browsing.search_web")
    @patch("app.services.web_browsing.fetch_web_page")
    def test_browse_web_unified(self, mock_fetch, mock_search):
        mock_search.return_value = {"results": [{"title": "Search Item"}]}
        mock_fetch.return_value = {"title": "Page Title", "content": "Page content"}

        res1 = browse_web(query="test query")
        self.assertIn("search", res1)
        self.assertNotIn("page", res1)

        res2 = browse_web(url="https://example.com")
        self.assertIn("page", res2)
        self.assertNotIn("search", res2)

        res3 = browse_web(query="test query", url="https://example.com")
        self.assertIn("search", res3)
        self.assertIn("page", res3)

    @patch("app.services.web_browsing.browse_web")
    @patch("app.services.web_browsing.search_web")
    @patch("app.services.web_browsing.fetch_web_page")
    def test_run_tool_eve_integration(self, mock_fetch, mock_search, mock_browse):
        mock_browse.return_value = {"search": {"results": []}}
        mock_search.return_value = {"query": "python", "results": []}
        mock_fetch.return_value = {"url": "https://example.com", "title": "Example"}

        mock_db = MagicMock()
        user_id = "test-user-id"

        # Test browse_web
        res, changed, action = dispatch_tool(mock_db, user_id, "browse_web", {"query": "test"})
        self.assertIn("search", res)

        # Test search_web
        res, changed, action = dispatch_tool(mock_db, user_id, "search_web", {"query": "python"})
        self.assertEqual(res["query"], "python")

        # Test web_search alias
        res, changed, action = dispatch_tool(mock_db, user_id, "web_search", {"query": "python"})
        self.assertEqual(res["query"], "python")

        # Test fetch_web_page
        res, changed, action = dispatch_tool(mock_db, user_id, "fetch_web_page", {"url": "https://example.com"})
        self.assertEqual(res["title"], "Example")

        # Test read_web_page alias
        res, changed, action = dispatch_tool(mock_db, user_id, "read_web_page", {"url": "https://example.com"})
        self.assertEqual(res["title"], "Example")


if __name__ == "__main__":
    unittest.main()
