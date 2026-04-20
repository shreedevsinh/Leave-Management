import { Test, TestingModule } from '@nestjs/testing';
import { OfficetimeService } from './officetime.service';

describe('OfficetimeService', () => {
  let service: OfficetimeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OfficetimeService],
    }).compile();

    service = module.get<OfficetimeService>(OfficetimeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
