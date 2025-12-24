import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { IsString, IsNotEmpty } from "class-validator";
import { KeywordsService } from "./keywords.service";
import { KeywordSuggestion } from "../services/dataforseo.service";

export class SuggestKeywordsDto {
  @IsString()
  @IsNotEmpty()
  seedKeyword: string;
}

@Controller("api/keywords")
export class KeywordsController {
  constructor(private readonly keywordsService: KeywordsService) {}

  @Post("suggest")
  @HttpCode(HttpStatus.OK)
  async suggestKeywords(
    @Body() dto: SuggestKeywordsDto
  ): Promise<{ suggestions: Array<KeywordSuggestion & { id: string }> }> {
    // Debug logging
    console.log("Received request body:", JSON.stringify(dto));
    console.log("DTO seedKeyword:", dto?.seedKeyword);

    if (!dto || !dto.seedKeyword) {
      throw new Error("seedKeyword is required in request body");
    }

    const suggestions = await this.keywordsService.suggestKeywords(
      dto.seedKeyword
    );
    return { suggestions };
  }

  @Get(":id")
  async getKeyword(@Param("id") id: string) {
    return await this.keywordsService.findById(id);
  }
}
