import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiParam, ApiExtraModels } from '@nestjs/swagger';
import { ApiDataResponse } from '@/common/decorators';
import { formatResponse } from '@/common/helpers';
import type { ApiResponse } from '@/common/interfaces';
import { CredentialService } from '../services/credential.service';
import { CreateCredentialDto, UpdateCredentialDto, CredentialResponseDto } from '../dto';

@ApiTags('Credentials')
@ApiExtraModels(CreateCredentialDto, UpdateCredentialDto, CredentialResponseDto)
@Controller({ path: 'credentials', version: '1' })
export class CredentialController {
  constructor(private readonly credentialService: CredentialService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List credentials (values redacted)' })
  @ApiDataResponse(CredentialResponseDto, { isArray: true })
  async findAll(): Promise<ApiResponse<CredentialResponseDto[]>> {
    const credentials = await this.credentialService.findAll();
    return formatResponse.array(CredentialResponseDto, credentials, 'Credentials retrieved successfully.');
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get credential by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(CredentialResponseDto)
  async findById(@Param('id') id: string): Promise<ApiResponse<CredentialResponseDto>> {
    const credential = await this.credentialService.findById(id);
    return formatResponse.single(CredentialResponseDto, credential, 'Credential retrieved successfully.');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create credential' })
  @ApiBody({ type: CreateCredentialDto })
  @ApiDataResponse(CredentialResponseDto)
  async create(@Body() dto: CreateCredentialDto): Promise<ApiResponse<CredentialResponseDto>> {
    const credential = await this.credentialService.create(dto);
    return formatResponse.single(CredentialResponseDto, credential, 'Credential created successfully.');
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update credential' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateCredentialDto })
  @ApiDataResponse(CredentialResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCredentialDto,
  ): Promise<ApiResponse<CredentialResponseDto>> {
    const credential = await this.credentialService.update(id, dto);
    return formatResponse.single(CredentialResponseDto, credential, 'Credential updated successfully.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete credential' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(null)
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.credentialService.softDelete(id);
    return formatResponse.single(null, null, 'Credential deleted successfully.');
  }
}
