import { Test, TestingModule } from '@nestjs/testing';
import { FileImportService } from './file-import.service';

describe('FileImportService', () => {
  let service: FileImportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileImportService],
    }).compile();

    service = module.get<FileImportService>(FileImportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
