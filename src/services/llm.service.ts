import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export interface GapAnalysisResult {
  targetFormat:
    | "Listicle"
    | "How-to Guide"
    | "Deep-Dive Essay"
    | "Comparison"
    | "Tutorial";
  informationGainAngle: string;
  competitorHeadings: string[];
  recommendedApproach: string;
}

export interface OutlineSection {
  heading: string;
  intent: string;
  keywordsToInclude: string[];
}

export interface ArticleOutline {
  title: string;
  sections: OutlineSection[];
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly ai: GoogleGenAI;
  private readonly model: string;
  private readonly config: {
    thinkingConfig: {
      thinkingLevel: ThinkingLevel;
    };
  };

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>("GEMINI_API_KEY") || "";
    this.model =
      this.configService.get<string>("GEMINI_MODEL") || "gemini-3-pro-preview";

    this.ai = new GoogleGenAI({
      apiKey,
    });
  }

  /**
   * Analyze SERP to identify format and content gaps
   */
  async analyzeGap(
    keyword: string,
    serpResults: Array<{
      title: string;
      snippet: string;
      link: string;
      headings?: string[];
    }>,
    paaQuestions: Array<{ question: string }>
  ): Promise<GapAnalysisResult> {
    // Build competitor analysis with headings
    const competitorAnalysis = serpResults
      .map((r, index) => {
        const headingsText =
          r.headings && r.headings.length > 0
            ? `\nHeadings:\n${r.headings.map((h, i) => `  ${i + 1}. ${h}`).join("\n")}`
            : "\nHeadings: (Not available)";
        return `Competitor ${index + 1}:
Title: ${r.title}
Snippet: ${r.snippet}
Link: ${r.link}${headingsText}`;
      })
      .join("\n\n");

    const paaList = paaQuestions.map((q) => q.question).join("\n");

    const prompt = `You are an SEO content strategist. Analyze the SERP for the keyword "${keyword}".

Competitor Analysis:
${competitorAnalysis}

People Also Ask Questions:
${paaList}

Based on this analysis:
1. Identify the dominant content format (Listicle, How-to Guide, Deep-Dive Essay, Comparison, or Tutorial)
2. Analyze the headings structure of each competitor to understand their content organization
3. Determine what specific sub-topic or expert perspective is MISSING that would provide "Information Gain" for readers
4. Recommend a unique angle that competitors haven't covered, considering both their titles/snippets and heading structures

Respond in JSON format:
{
  "targetFormat": "Listicle|How-to Guide|Deep-Dive Essay|Comparison|Tutorial",
  "informationGainAngle": "specific angle that provides unique value",
  "competitorHeadings": ["heading1", "heading2", "heading3"],
  "recommendedApproach": "brief explanation of the recommended content approach"
}`;

    try {
      const systemPrompt =
        "You are an expert SEO content strategist. Always respond with valid JSON only.";

      const response = await this.ai.models.generateContentStream({
        model: this.model,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          systemInstruction: systemPrompt,
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      });

      let content = "";
      for await (const chunk of response) {
        if (chunk.text) {
          content += chunk.text;
        }
      }

      if (!content) {
        throw new Error("No response from Gemini");
      }

      const result = JSON.parse(content) as GapAnalysisResult;
      this.logger.log(`Gap analysis completed for keyword: ${keyword}`);
      return result;
    } catch (error) {
      this.logger.error(`Error in gap analysis: ${error.message}`, error.stack);
      throw new Error(`Failed to analyze gap: ${error.message}`);
    }
  }

  /**
   * Generate SEO outline based on strategy
   */
  async generateOutline(
    keyword: string,
    targetFormat: string,
    informationGainAngle: string,
    paaQuestions: Array<{ question: string }>
  ): Promise<ArticleOutline> {
    const paaList = paaQuestions.map((q) => q.question).join("\n");

    const prompt = `Create a comprehensive SEO-optimized article outline for the keyword "${keyword}".

Target Format: ${targetFormat}
Information Gain Angle: ${informationGainAngle}
People Also Ask Questions:
${paaList}

Generate a structured outline with:
- A keyword-optimized title (include the primary keyword naturally)
- Multiple sections (H2 headings) that:
  * Address the information gain angle
  * Answer the PAA questions
  * Include supporting keywords naturally
  * Follow the target format structure

Respond in JSON format:
{
  "title": "SEO-optimized title with primary keyword",
  "sections": [
    {
      "heading": "H2 heading",
      "intent": "what this section aims to achieve",
      "keywordsToInclude": ["keyword1", "keyword2"]
    }
  ]
}

Ensure the outline has at least 6-8 sections for a comprehensive long-form article.`;

    try {
      const systemPrompt =
        "You are an expert SEO content writer. Always respond with valid JSON only.";

      const response = await this.ai.models.generateContentStream({
        model: this.model,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          systemInstruction: systemPrompt,
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      });

      let content = "";
      for await (const chunk of response) {
        if (chunk.text) {
          content += chunk.text;
        }
      }

      if (!content) {
        throw new Error("No response from Gemini");
      }

      const result = JSON.parse(content) as ArticleOutline;
      this.logger.log(`Outline generated for keyword: ${keyword}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error generating outline: ${error.message}`,
        error.stack
      );
      throw new Error(`Failed to generate outline: ${error.message}`);
    }
  }

  /**
   * Generate introduction section
   */
  async generateIntroduction(
    keyword: string,
    title: string,
    informationGainAngle: string
  ): Promise<string> {
    const prompt = `Write a compelling introduction for an article with the title: "${title}"

Primary Keyword: ${keyword}
Information Gain Angle: ${informationGainAngle}

Requirements:
- Include the primary keyword in the first paragraph naturally
- Hook the reader with a compelling opening
- Explain what unique value this article provides
- Set expectations for what they'll learn
- Keep it engaging and conversational
- Length: 150-200 words

Write in markdown format.`;

    try {
      const systemPrompt =
        "You are an expert content writer. Write engaging, SEO-optimized content.";

      const response = await this.ai.models.generateContentStream({
        model: this.model,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          systemInstruction: systemPrompt,
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      });

      let content = "";
      for await (const chunk of response) {
        if (chunk.text) {
          content += chunk.text;
        }
      }

      if (!content) {
        throw new Error("No response from Gemini");
      }

      return content;
    } catch (error) {
      this.logger.error(
        `Error generating introduction: ${error.message}`,
        error.stack
      );
      throw new Error(`Failed to generate introduction: ${error.message}`);
    }
  }

  /**
   * Generate a section of the article
   */
  async generateSection(
    sectionTitle: string,
    sectionIntent: string,
    keywordsToInclude: string[],
    previousSectionSummary: string,
    informationGainAngle: string,
    articleTitle: string
  ): Promise<string> {
    const keywordsList = keywordsToInclude.join(", ");

    const prompt = `Write a comprehensive section for an article.

Article Title: ${articleTitle}
Section Title: ${sectionTitle}
Section Intent: ${sectionIntent}
Keywords to Include: ${keywordsList}
Information Gain Angle: ${informationGainAngle}
Previous Section Context: ${previousSectionSummary || "This is the first section after introduction"}

Requirements:
- Write in markdown format
- Use the section title as an H2 heading
- Include the specified keywords naturally
- Provide deep, valuable information
- Address the section intent thoroughly
- Maintain consistency with the information gain angle
- Length: 300-500 words
- Use H3 subheadings where appropriate
- Include examples, tips, or actionable insights

Write the full section content in markdown.`;

    try {
      const systemPrompt =
        "You are an expert content writer. Write comprehensive, SEO-optimized long-form content.";

      const response = await this.ai.models.generateContentStream({
        model: this.model,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          systemInstruction: systemPrompt,
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      });

      let content = "";
      for await (const chunk of response) {
        if (chunk.text) {
          content += chunk.text;
        }
      }

      if (!content) {
        throw new Error("No response from Gemini");
      }

      return content;
    } catch (error) {
      this.logger.error(
        `Error generating section: ${error.message}`,
        error.stack
      );
      throw new Error(`Failed to generate section: ${error.message}`);
    }
  }

  /**
   * Generate conclusion section
   */
  async generateConclusion(
    articleTitle: string,
    keyword: string,
    articleSummary: string
  ): Promise<string> {
    const prompt = `Write a compelling conclusion for an article.

Article Title: ${articleTitle}
Primary Keyword: ${keyword}
Article Summary: ${articleSummary}

Requirements:
- Summarize key takeaways
- Reinforce the main value proposition
- Include a clear call-to-action (CTA)
- Include the primary keyword naturally
- Keep it engaging and actionable
- Length: 150-200 words
- Write in markdown format

Write the conclusion content.`;

    try {
      const systemPrompt =
        "You are an expert content writer. Write engaging conclusions with strong CTAs.";

      const response = await this.ai.models.generateContentStream({
        model: this.model,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          systemInstruction: systemPrompt,
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      });

      let content = "";
      for await (const chunk of response) {
        if (chunk.text) {
          content += chunk.text;
        }
      }

      if (!content) {
        throw new Error("No response from Gemini");
      }

      return content;
    } catch (error) {
      this.logger.error(
        `Error generating conclusion: ${error.message}`,
        error.stack
      );
      throw new Error(`Failed to generate conclusion: ${error.message}`);
    }
  }
}
