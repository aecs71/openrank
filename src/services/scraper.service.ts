import { Injectable, Logger } from "@nestjs/common";
import { Configuration, MemoryStorage, PlaywrightCrawler } from "crawlee";
import { randomUUID } from "node:crypto";

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  /**
   * Scrape headings (H2/H3) from a URL using Playwright
   */
  async scrapeHeadings(url: string): Promise<string[]> {
    const headings: string[] = [];
    let crawler: PlaywrightCrawler | null = null;

    try {
      crawler = new PlaywrightCrawler({
        maxRequestsPerCrawl: 1,
        maxRequestRetries: 1,
        requestHandlerTimeoutSecs: 30,
        headless: true,
        requestHandler: async ({ page, request, log }) => {
          try {
            // Wait for content to load
            await page
              .waitForLoadState("networkidle", { timeout: 10000 })
              .catch(() => {
                // Continue even if networkidle times out
              });

            // Extract headings using Playwright
            const headingElements = await page.locator("h2, h3").all();

            for (const element of headingElements) {
              const text = (await element.textContent())?.trim();
              if (text) {
                headings.push(text);
              }
            }

            log.info(
              `Scraped ${headings.length} headings from ${
                request.loadedUrl || request.url
              }`
            );
          } catch (error: any) {
            log.warning(
              `Error extracting headings from ${request.url}: ${error.message}`
            );
          }
        },
        failedRequestHandler: ({ request, log }) => {
          log.warning(
            `Failed to scrape headings from ${request.url} after retries`
          );
        },
      });

      await crawler.run([url]);
      return headings;
    } catch (error: any) {
      this.logger.warn(
        `Failed to scrape headings from ${url}: ${error.message}`
      );
      return [];
    } finally {
      // Ensure crawler is properly cleaned up to free browser resources
      if (crawler) {
        try {
          await crawler.teardown();
          // Small delay to ensure browser processes are fully closed
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error: any) {
          this.logger.warn(`Error during crawler teardown: ${error.message}`);
        }
      }
    }
  }

  /**
   * Scrape headings from multiple URLs using a single crawler instance
   * This is more efficient and avoids browser instance conflicts
   */
  async scrapeMultipleHeadings(
    urls: string[]
  ): Promise<Record<string, string[]>> {
    const results: Record<string, string[]> = {};
    let crawler: PlaywrightCrawler | null = null;

    try {
      const storage = new MemoryStorage();
      const config = new Configuration({
        storageClient: storage,
      });
      crawler = new PlaywrightCrawler(
        {
          maxRequestsPerCrawl: urls.length,
          maxRequestRetries: 1,
          requestHandlerTimeoutSecs: 30,
          headless: true,
          requestHandler: async ({ page, request, log }) => {
            const headings: string[] = [];
            try {
              // Wait for content to load
              await page
                .waitForLoadState("networkidle", { timeout: 10000 })
                .catch(() => {
                  // Continue even if networkidle times out
                });

              // Extract headings using Playwright
              const headingElements = await page.locator("h2, h3").all();

              for (const element of headingElements) {
                const text = (await element.textContent())?.trim();
                if (text) {
                  headings.push(text);
                }
              }

              // Store results by URL
              results[request.loadedUrl || request.url] = headings;

              log.info(
                `Scraped ${headings.length} headings from ${
                  request.loadedUrl || request.url
                }`
              );
            } catch (error: any) {
              log.warning(
                `Error extracting headings from ${request.url}: ${error.message}`
              );
              // Store empty array for failed URLs
              results[request.loadedUrl || request.url] = [];
            }
          },
          failedRequestHandler: ({ request, log }) => {
            log.warning(
              `Failed to scrape headings from ${request.url} after retries`
            );
            // Store empty array for failed URLs
            results[request.url] = [];
          },
        },
        config
      );

      await crawler.run(urls);
      return results;
    } catch (error: any) {
      this.logger.warn(`Failed to scrape multiple headings: ${error.message}`);
      // Return empty results for all URLs on error
      urls.forEach((url) => {
        if (!results[url]) {
          results[url] = [];
        }
      });
      return results;
    } finally {
      // Ensure crawler is properly cleaned up
      if (crawler) {
        try {
          await crawler.teardown();
          // Small delay to ensure browser processes are fully closed
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error: any) {
          this.logger.warn(`Error during crawler teardown: ${error.message}`);
        }
      }
    }
  }
}
