import { Module } from "@nestjs/common";
import { DataForSeoService } from "./dataforseo.service";
import { LlmService } from "./llm.service";
import { ScraperService } from "./scraper.service";
import { SeoScoringService } from "./seo-scoring.service";

@Module({
  providers: [DataForSeoService, LlmService, ScraperService, SeoScoringService],
  exports: [DataForSeoService, LlmService, ScraperService, SeoScoringService],
})
export class ServicesModule {}
