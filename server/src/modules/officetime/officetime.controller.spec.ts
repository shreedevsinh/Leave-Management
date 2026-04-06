import { Test, TestingModule } from '@nestjs/testing';
import { OfficetimeController } from './officetime.controller';

describe('OfficetimeController', () => {
  let controller: OfficetimeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OfficetimeController],
    }).compile();

    controller = module.get<OfficetimeController>(OfficetimeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
