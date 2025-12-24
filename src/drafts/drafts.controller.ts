import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { DraftsService } from "./drafts.service";
import { DraftStatus } from "./entities/draft.entity";
import { IsNotEmpty } from "class-validator";
import { IsUUID } from "class-validator";

export class CreateDraftDto {
  @IsNotEmpty()
  @IsUUID()
  keywordId: string;
}

export class UpdateOutlineDto {
  outline: any;
}

@Controller("api/drafts")
export class DraftsController {
  constructor(private readonly draftsService: DraftsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDraft(@Body() dto: CreateDraftDto) {
    return await this.draftsService.createDraft(dto.keywordId);
  }

  @Get()
  async getAllDrafts() {
    return await this.draftsService.findAll();
  }

  @Get(":id")
  async getDraft(@Param("id") id: string) {
    return await this.draftsService.findById(id);
  }

  @Put(":id/outline")
  async updateOutline(@Param("id") id: string, @Body() dto: UpdateOutlineDto) {
    return await this.draftsService.updateOutline(id, dto.outline);
  }

  @Put(":id/approve-outline")
  async approveOutline(@Param("id") id: string) {
    return await this.draftsService.approveOutline(id);
  }

  @Get(":id/export")
  async exportDraft(@Param("id") id: string) {
    const draft = await this.draftsService.findById(id);
    if (!draft) {
      throw new Error(`Draft with ID ${id} not found`);
    }

    if (!draft.content) {
      throw new Error("Draft content not available");
    }

    return {
      id: draft.id,
      title: draft.title,
      content: draft.content,
      format: "markdown",
      exportedAt: new Date().toISOString(),
    };
  }
}
