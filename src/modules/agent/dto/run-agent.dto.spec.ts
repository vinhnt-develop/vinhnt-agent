import { ValidationPipe } from "@nestjs/common";
import { RunAgentDto } from "./run-agent.dto";

function makePipe() {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
  });
}

describe("RunAgentDto permissionMode", () => {
  it("keeps permissionMode when whitelisting the HTTP body", async () => {
    const dto = await makePipe().transform(
      {
        sessionId: "session-1",
        prompt: "hello",
        permissionMode: "bypass",
      },
      { type: "body", metatype: RunAgentDto },
    );

    expect(dto.permissionMode).toBe("bypass");
  });

  it("rejects a non-string permissionMode", async () => {
    await expect(
      makePipe().transform(
        {
          sessionId: "session-1",
          prompt: "hello",
          permissionMode: 42,
        },
        { type: "body", metatype: RunAgentDto },
      ),
    ).rejects.toThrow();
  });
});
