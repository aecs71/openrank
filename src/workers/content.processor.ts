import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { LlmService } from "../services/llm.service";
import { DraftsService } from "../drafts/drafts.service";
import { SeoScoringService } from "../services/seo-scoring.service";
import { DraftStatus } from "../drafts/entities/draft.entity";

interface ContentJobData {
  draftId: string;
  outline: any;
  strategy: any;
}

@Processor("content", {
  lockDuration: 900000, // 15 minutes in milliseconds - content generation can be very long
  lockRenewTime: 450000, // Renew lock every 7.5 minutes
})
export class ContentProcessor extends WorkerHost {
  private readonly logger = new Logger(ContentProcessor.name);

  constructor(
    private llmService: LlmService,
    private draftsService: DraftsService,
    private seoScoringService: SeoScoringService
  ) {
    super();
  }

  async process(job: Job<ContentJobData>): Promise<void> {
    const { draftId, outline, strategy } = job.data;
    this.logger.log(`Processing content generation for draft ${draftId}`);

    try {
      // Update status to WRITING
      await this.draftsService.updateStatus(draftId, DraftStatus.WRITING);

      // Get draft to access keyword
      let draft = await this.draftsService.findById(draftId);
      if (!draft || !draft.primaryKeyword) {
        throw new Error(`Draft ${draftId} or primary keyword not found`);
      }

      const keyword = draft.primaryKeyword.keyword;
      const informationGainAngle = strategy.informationGainAngle;

      // Step 1: Generate Introduction
      this.logger.log(`Generating introduction...`);
      const introduction = await this.llmService.generateIntroduction(
        keyword,
        outline.title,
        informationGainAngle
      );

      await this.draftsService.appendContent(
        draftId,
        introduction,
        outline.title,
        0,
        "introduction"
      );

      let previousSectionSummary = introduction.substring(0, 200); // First 200 chars as context

      // Step 2: Generate each section
      this.logger.log(`Generating ${outline.sections.length} sections...`);
      for (let i = 0; i < outline.sections.length; i++) {
        const section = outline.sections[i];
        this.logger.log(
          `Generating section ${i + 1}/${outline.sections.length}: ${section.heading}`
        );

        const sectionContent = await this.llmService.generateSection(
          section.heading,
          section.intent,
          section.keywordsToInclude || [],
          previousSectionSummary,
          informationGainAngle,
          outline.title
        );

        await this.draftsService.appendContent(
          draftId,
          sectionContent,
          section.heading,
          i + 1,
          "section"
        );

        // Update previous section summary for next iteration
        previousSectionSummary = sectionContent.substring(0, 200);
      }

      // Step 3: Generate Conclusion
      this.logger.log(`Generating conclusion...`);
      // Re-fetch draft to get updated sections
      draft = await this.draftsService.findById(draftId);
      const allContent =
        draft?.sections
          ?.sort((a, b) => a.order - b.order)
          .map((s) => s.content)
          .join("\n\n") || "";

      const conclusion = await this.llmService.generateConclusion(
        outline.title,
        keyword,
        allContent.substring(0, 1000) // First 1000 chars as summary
      );

      await this.draftsService.appendContent(
        draftId,
        conclusion,
        "Conclusion",
        outline.sections.length + 1,
        "conclusion"
      );

      // Step 4: Compile final content
      const finalDraft = await this.draftsService.findById(draftId);
      const finalContent =
        finalDraft?.sections
          ?.sort((a, b) => a.order - b.order)
          .map((s) => {
            if (s.type === "introduction") {
              return `# ${s.heading}\n\n${s.content}`;
            }
            return s.content;
          })
          .join("\n\n") || "";

      await this.draftsService.updateContent(draftId, finalContent);

      // Step 5: Calculate SEO score
      this.logger.log(`Calculating SEO score...`);
      const seoScore = await this.seoScoringService.calculateScore(
        finalContent,
        keyword,
        strategy
      );

      await this.draftsService.updateSeoScore(draftId, seoScore);

      this.logger.log(`Content generation completed for draft ${draftId}`);
    } catch (error) {
      this.logger.error(
        `Error processing content job: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
