import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Keyword, DifficultyLevel } from "./entities/keyword.entity";
import {
  DataForSeoService,
  KeywordSuggestion,
} from "../services/dataforseo.service";

@Injectable()
export class KeywordsService {
  private readonly logger = new Logger(KeywordsService.name);

  constructor(
    @InjectRepository(Keyword)
    private keywordRepository: Repository<Keyword>,
    private dataForSeoService: DataForSeoService
  ) {}

  /**
   * Get keyword suggestions for a seed keyword and automatically save them to database
   */
  async suggestKeywords(
    seedKeyword: string
  ): Promise<Array<KeywordSuggestion & { id: string }>> {
    if (!seedKeyword || seedKeyword.trim() === "") {
      this.logger.warn("Empty or undefined seedKeyword provided");
      return [];
    }

    this.logger.log(`Fetching keyword suggestions for: ${seedKeyword}`);
    const suggestions =
      await this.dataForSeoService.getKeywordSuggestions(seedKeyword);

    // Save all suggestions to database and return with IDs
    const savedKeywords = await Promise.all(
      suggestions.map(async (suggestion) => {
        // Check if keyword already exists
        let keyword = await this.findByKeyword(suggestion.keyword);

        if (!keyword) {
          // Create new keyword
          keyword = await this.createKeyword({
            keyword: suggestion.keyword,
            difficulty: suggestion.difficulty,
            difficultyLevel: suggestion.difficultyLevel,
            searchVolume: suggestion.searchVolume,
            metadata: suggestion.metadata,
            kcv: suggestion.kcv,
          });
        }

        // Return suggestion with database ID
        return {
          ...suggestion,
          id: keyword.id,
        };
      })
    );

    this.logger.log(`Saved ${savedKeywords.length} keywords to database`);
    return savedKeywords;
  }

  /**
   * Create a keyword record
   */
  async createKeyword(keywordData: {
    keyword: string;
    difficulty?: number;
    difficultyLevel?: DifficultyLevel;
    searchVolume?: number;
    metadata?: any;
    kcv?: number;
  }): Promise<Keyword> {
    const keyword = this.keywordRepository.create(keywordData);
    return await this.keywordRepository.save(keyword);
  }

  /**
   * Find keyword by ID
   */
  async findById(id: string): Promise<Keyword | null> {
    return await this.keywordRepository.findOne({ where: { id } });
  }

  /**
   * Find keyword by keyword string
   */
  async findByKeyword(keyword: string): Promise<Keyword | null> {
    return await this.keywordRepository.findOne({ where: { keyword } });
  }
}
