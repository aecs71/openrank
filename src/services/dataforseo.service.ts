import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import { DifficultyLevel } from "../keywords/entities/keyword.entity";

export interface KeywordSuggestion {
  keyword: string;
  difficulty: number;
  difficultyLevel: DifficultyLevel;
  searchVolume?: number;
  cpc?: number;
  competition?: number;
  metadata?: any;
  kcv?: number;
}

export interface SerpResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface PeopleAlsoAsk {
  question: string;
  snippet: string;
  title: string;
  link: string;
}

export interface SerpData {
  organic: SerpResult[];
  peopleAlsoAsk: PeopleAlsoAsk[];
  relatedSearches?: string[];
}

@Injectable()
export class DataForSeoService {
  private readonly logger = new Logger(DataForSeoService.name);
  private readonly apiClient: AxiosInstance;
  private readonly login: string;
  private readonly password: string;

  constructor(private configService: ConfigService) {
    this.login = this.configService.get<string>("DATAFORSEO_LOGIN") || "";
    this.password = this.configService.get<string>("DATAFORSEO_PASSWORD") || "";

    const authToken =
      this.configService.get<string>("DATAFORSEO_AUTH_TOKEN") || "";

    this.apiClient = axios.create({
      baseURL: "https://api.dataforseo.com/v3/",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authToken}`,
      },
    });
  }

  /**
   * Map difficulty score (0-100) to DifficultyLevel enum
   */
  private mapDifficultyLevel(difficulty: number): DifficultyLevel {
    if (difficulty <= 30) return DifficultyLevel.LOW;
    if (difficulty <= 60) return DifficultyLevel.MEDIUM;
    return DifficultyLevel.HIGH;
  }

  /**
   * Get keyword suggestions from DataForSEO Labs API
   */
  async getKeywordSuggestions(
    seedKeyword: string
  ): Promise<KeywordSuggestion[]> {
    try {
      const response = await this.apiClient.post(
        "/keywords_data/google_ads/keywords_for_keywords/live",
        [
          {
            location_code: 2840, // United States
            language_code: "en",
            keywords: [seedKeyword],
            limit: 50,
          },
        ]
      );

      if (
        !response.data ||
        !response.data.tasks ||
        response.data.tasks.length === 0
      ) {
        this.logger.warn(`No keyword suggestions found for: ${seedKeyword}`);
        return [];
      }

      const task = response.data.tasks[0];
      if (!task.result || task.result.length === 0) {
        return [];
      }
      // Log the first 100 results from task.result
      // console.log(
      //   `First 100 results for "${seedKeyword}":\n` +
      //     JSON.stringify(task.result.slice(0, 25))
      // );

      // First, map and compute KCV for each item, then sort and pick top 10
      // Remove difficulty calculation. Map difficultyLevel to competition string, difficulty to competition_index (number).
      const suggestions: KeywordSuggestion[] = task.result
        .filter(
          (item: any) =>
            typeof item.keyword === "string" && item.keyword.trim().length > 0
        )
        .map((item: any) => {
          const keyword = item.keyword;
          const location_code = item.location_code;
          const language_code = item.language_code;
          const search_partners =
            "search_partners" in item ? item.search_partners : false;

          const competition_index =
            typeof item.competition_index === "number"
              ? item.competition_index
              : 0;

          // 'competition' should be a string ('LOW', 'MEDIUM', 'HIGH' etc) as per sample
          const competition =
            typeof item.competition === "string" && item.competition
              ? item.competition
              : "LOW";

          const search_volume =
            typeof item.search_volume === "number" ? item.search_volume : 0;

          const low_top_of_page_bid =
            typeof item.low_top_of_page_bid === "number"
              ? item.low_top_of_page_bid
              : null;
          const high_top_of_page_bid =
            typeof item.high_top_of_page_bid === "number"
              ? item.high_top_of_page_bid
              : null;
          const cpc = typeof item.cpc === "number" ? item.cpc : 0;

          // KCV as before
          const kcv = (search_volume * cpc) / (competition_index + 1);

          // Concepts array ("keyword_annotations.concepts" can be null or array)
          let keyword_annotations: any = { concepts: null };
          if (
            item.keyword_annotations &&
            Array.isArray(item.keyword_annotations.concepts)
          ) {
            keyword_annotations.concepts =
              item.keyword_annotations.concepts.map((c: any) => ({
                name: c.name,
                concept_group: c.concept_group,
              }));
          }

          // Monthly searches, if present
          let monthly_searches = [];
          if (Array.isArray(item.monthly_searches)) {
            monthly_searches = item.monthly_searches.map((m: any) => ({
              year: m.year,
              month: m.month,
              search_volume: m.search_volume,
            }));
          }

          // Compose metadata as per what is in the sample JSON
          const metadata = {
            keyword,
            location_code,
            language_code,
            search_partners,
            competition,
            competition_index,
            search_volume,
            low_top_of_page_bid,
            high_top_of_page_bid,
            cpc: cpc === null ? null : cpc,
            monthly_searches,
            keyword_annotations,
          };

          // difficulty: use competition_index; difficultyLevel: use competition string
          return {
            keyword,
            difficulty: competition_index,
            difficultyLevel: competition,
            searchVolume: search_volume,
            cpc: cpc === null ? 0 : cpc,
            competition,
            metadata,
            kcv: kcv,
          };
        })
        .sort((a, b) => (b.kcv ?? 0) - (a.kcv ?? 0))
        .slice(0, 10);
      //.map(({ _kcv, ...suggestion }) => suggestion);
      console.log(
        `Top 10 results for "${seedKeyword}":\n` + JSON.stringify(suggestions)
      );

      this.logger.log(
        `Found ${suggestions.length} keyword suggestions for: ${seedKeyword}`
      );
      return suggestions;
    } catch (error) {
      this.logger.error(
        `Error fetching keyword suggestions: ${error.message}`,
        error.stack
      );
      throw new Error(`Failed to fetch keyword suggestions: ${error.message}`);
    }
  }

  /**
   * Get keyword difficulty for a specific keyword
   */
  async getKeywordDifficulty(keyword: string): Promise<{
    difficulty: number;
    difficultyLevel: DifficultyLevel;
  }> {
    try {
      const response = await this.apiClient.post(
        "/dataforseo_labs/google/keywords_for_keywords/live",
        [
          {
            location_code: 2840,
            language_code: "en",
            keywords: [keyword],
            limit: 1,
          },
        ]
      );

      if (!response.data?.tasks?.[0]?.result?.[0]) {
        return { difficulty: 0, difficultyLevel: DifficultyLevel.LOW };
      }

      const result = response.data.tasks[0].result[0];
      const difficulty = result.keyword_difficulty || 0;

      return {
        difficulty,
        difficultyLevel: this.mapDifficultyLevel(difficulty),
      };
    } catch (error) {
      this.logger.error(
        `Error fetching keyword difficulty: ${error.message}`,
        error.stack
      );
      return { difficulty: 0, difficultyLevel: DifficultyLevel.LOW };
    }
  }

  /**
   * Fetch SERP data for a keyword using DataForSEO API
   */
  async getSearchResults(keyword: string): Promise<SerpData> {
    try {
      const response = await this.apiClient.post(
        "/serp/google/organic/live/regular",
        [
          {
            language_code: "en",
            location_code: 2840, // United States
            keyword: keyword,
          },
        ]
      );

      // Check if response has tasks and results
      if (
        !response.data ||
        !response.data.tasks ||
        response.data.tasks.length === 0 ||
        !response.data.tasks[0].result ||
        response.data.tasks[0].result.length === 0
      ) {
        this.logger.warn(`No SERP results found for keyword: ${keyword}`);
        return {
          organic: [],
          peopleAlsoAsk: [],
          relatedSearches: [],
        };
      }

      const result = response.data.tasks[0].result[0];
      const items = result.items || [];

      // Extract organic results
      const organicItems = items.filter((item: any) => item.type === "organic");
      const organic: SerpResult[] = organicItems.map((item: any) => ({
        title: item.title || "",
        link: item.url || "",
        snippet: item.description || "",
        position: item.rank_absolute || item.rank_group || 0,
      }));

      // Extract People Also Ask
      const peopleAlsoAskItems = items.filter(
        (item: any) => item.type === "people_also_ask"
      );
      const peopleAlsoAsk: PeopleAlsoAsk[] = peopleAlsoAskItems
        .flatMap((item: any) => item.items || [])
        .map((item: any) => ({
          question: item.question || item.title || "",
          snippet: item.description || item.snippet || "",
          title: item.title || "",
          link: item.url || item.link || "",
        }));

      // Extract Related Searches
      const relatedSearchesItems = items.filter(
        (item: any) => item.type === "related_searches"
      );
      const relatedSearches: string[] = relatedSearchesItems
        .flatMap((item: any) => item.items || [])
        .map((item: any) => item.text || item.query || "")
        .filter((text: string) => text.length > 0);

      this.logger.log(
        `Fetched SERP data for keyword: ${keyword} - ${organic.length} organic results, ${peopleAlsoAsk.length} PAA items, ${relatedSearches.length} related searches`
      );

      return {
        organic,
        peopleAlsoAsk,
        relatedSearches,
      };
    } catch (error: any) {
      this.logger.error(
        `Error fetching SERP data: ${error.message}`,
        error.stack
      );
      throw new Error(`Failed to fetch SERP data: ${error.message}`);
    }
  }
}
