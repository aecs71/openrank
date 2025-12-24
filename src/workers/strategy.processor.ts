import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { DataForSeoService } from "../services/dataforseo.service";
import { LlmService } from "../services/llm.service";
import { ScraperService } from "../services/scraper.service";
import { DraftsService } from "../drafts/drafts.service";
import { DraftStatus } from "../drafts/entities/draft.entity";

interface StrategyJobData {
  draftId: string;
  keyword: string;
}

@Processor("strategy", {
  lockDuration: 600000, // 10 minutes in milliseconds - enough time for SERP fetch + scraping + LLM analysis
  lockRenewTime: 300000, // Renew lock every 5 minutes
})
export class StrategyProcessor extends WorkerHost {
  private readonly logger = new Logger(StrategyProcessor.name);

  constructor(
    private dataForSeoService: DataForSeoService,
    private llmService: LlmService,
    private scraperService: ScraperService,
    private draftsService: DraftsService
  ) {
    super();
  }

  async process(job: Job<StrategyJobData>): Promise<void> {
    const { draftId, keyword } = job.data;
    this.logger.log(
      `Processing strategy analysis for draft ${draftId}, keyword: ${keyword}`
    );

    try {
      // Update status to ANALYZING
      await this.draftsService.updateStatus(draftId, DraftStatus.ANALYZING);
      await job.updateProgress(10);

      // Step 1: Fetch SERP data
      this.logger.log(`Fetching SERP data for keyword: ${keyword}`);
      const serpData = await this.dataForSeoService.getSearchResults(keyword);
      await job.updateProgress(30);

      // Step 2: Scrape headings from top 3 competitors
      this.logger.log(`Scraping competitor headings...`);
      const topCompetitors = serpData.organic.slice(0, 3);
      const competitorUrls = topCompetitors.map((c) => c.link);

      // Use scrapeMultipleHeadings to process all URLs with proper isolation
      this.logger.log(`Scraping ${competitorUrls.length} competitor URLs...`);
      const competitorHeadingsMap =
        await this.scraperService.scrapeMultipleHeadings(competitorUrls);
      await job.updateProgress(60);

      // Flatten all headings
      const allCompetitorHeadings = Object.values(competitorHeadingsMap).flat();

      // Step 3: Analyze gap using LLM
      this.logger.log(`Analyzing content gaps...`);
      await job.updateProgress(70);
      const gapAnalysis = await this.llmService.analyzeGap(
        keyword,
        topCompetitors.map((c) => ({
          title: c.title,
          snippet: c.snippet,
          link: c.link,
          headings: competitorHeadingsMap[c.link] || [],
        })),
        serpData.peopleAlsoAsk
      );
      await job.updateProgress(85);

      // Step 4: Save strategy to draft
      const strategy = {
        targetFormat: gapAnalysis.targetFormat,
        informationGainAngle: gapAnalysis.informationGainAngle,
        competitorHeadings: allCompetitorHeadings,
        recommendedApproach: gapAnalysis.recommendedApproach,
        serpData: {
          organic: serpData.organic,
          peopleAlsoAsk: serpData.peopleAlsoAsk,
          relatedSearches: serpData.relatedSearches,
        },
      };

      await this.draftsService.updateStrategy(draftId, strategy);
      await job.updateProgress(100);

      this.logger.log(`Strategy analysis completed for draft ${draftId}`);
    } catch (error) {
      this.logger.error(
        `Error processing strategy job: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
