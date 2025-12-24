import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { LlmService } from "../services/llm.service";
import { DraftsService } from "../drafts/drafts.service";

interface OutlineJobData {
  draftId: string;
  keyword: string;
  strategy: any;
}

@Processor("outline", {
  lockDuration: 300000, // 5 minutes in milliseconds - enough time for LLM outline generation
  lockRenewTime: 150000, // Renew lock every 2.5 minutes
})
export class OutlineProcessor extends WorkerHost {
  private readonly logger = new Logger(OutlineProcessor.name);

  constructor(
    private llmService: LlmService,
    private draftsService: DraftsService
  ) {
    super();
  }

  async process(job: Job<OutlineJobData>): Promise<void> {
    const { draftId, keyword, strategy } = job.data;
    this.logger.log(`Processing outline generation for draft ${draftId}`);

    try {
      // Generate outline using LLM
      const outline = await this.llmService.generateOutline(
        keyword,
        strategy.targetFormat,
        strategy.informationGainAngle,
        strategy.serpData?.peopleAlsoAsk || []
      );

      // Save outline to draft
      await this.draftsService.updateOutline(draftId, outline);

      this.logger.log(`Outline generated for draft ${draftId}`);
    } catch (error) {
      this.logger.error(
        `Error processing outline job: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
