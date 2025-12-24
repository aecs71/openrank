import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

@Injectable()
export class SeoScoringService {
  private readonly logger = new Logger(SeoScoringService.name);

  /**
   * Calculate SEO score for the generated content
   */
  async calculateScore(
    content: string,
    primaryKeyword: string,
    strategy: any,
  ): Promise<{
    keywordInH1: boolean;
    keywordInFirstParagraph: boolean;
    keywordInH2: boolean;
    entityDensity: number;
    wordCount: number;
  }> {
    // Parse markdown to check structure
    const $ = cheerio.load(this.markdownToHtml(content));

    // Check H1
    const h1 = $('h1').first().text();
    const keywordInH1 = h1.toLowerCase().includes(primaryKeyword.toLowerCase());

    // Check first paragraph
    const firstParagraph = $('p').first().text();
    const keywordInFirstParagraph = firstParagraph
      .toLowerCase()
      .includes(primaryKeyword.toLowerCase());

    // Check H2 headings
    const h2Headings = $('h2')
      .map((_, el) => $(el).text())
      .get();
    const keywordInH2 = h2Headings.some((heading) =>
      heading.toLowerCase().includes(primaryKeyword.toLowerCase()),
    );

    // Word count
    const textContent = $('body').text();
    const wordCount = textContent.split(/\s+/).filter((word) => word.length > 0).length;

    // Entity density (simplified - count keyword occurrences)
    const keywordOccurrences = (
      textContent.toLowerCase().match(new RegExp(primaryKeyword.toLowerCase(), 'g')) || []
    ).length;
    const entityDensity = wordCount > 0 ? (keywordOccurrences / wordCount) * 100 : 0;

    return {
      keywordInH1,
      keywordInFirstParagraph,
      keywordInH2,
      entityDensity: Math.round(entityDensity * 100) / 100,
      wordCount,
    };
  }

  /**
   * Convert markdown to HTML for parsing
   */
  private markdownToHtml(markdown: string): string {
    let html = markdown;

    // Convert headers
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');

    // Convert paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Convert bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Convert lists
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    return html;
  }
}

