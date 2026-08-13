import type { TeachingLevel } from "../types";
import { formatSeconds } from "../lib/utils";
import { teachingLevelLabel } from "../lib/teachingLevels";

export function TeachingFlowReadout({
  levels,
  teaching = false,
  showCue = true,
}: {
  levels: TeachingLevel[];
  teaching?: boolean;
  showCue?: boolean;
}) {
  return (
    <div
      className={`teaching-flow-readout${teaching ? " teaching-flow-live" : ""}`}
      aria-label="退階、正常與變化教學流程"
    >
      {levels.map((level, index) => (
        <section className={`flow-level flow-${level.kind}`} key={level.id}>
          <div className="flow-level-top">
            <span>
              {index + 1}. {teachingLevelLabel(level.kind)}
            </span>
            <small>{formatSeconds(level.durationSeconds)}</small>
          </div>
          <strong>{level.title}</strong>
          {level.instruction && <p>{level.instruction}</p>}
          {showCue && level.cue && (
            <div className="flow-level-cue">
              <b>Cue</b> {level.cue}
            </div>
          )}
          <small className="flow-level-reps">
            {level.reps || "次數未設定"}
          </small>
        </section>
      ))}
    </div>
  );
}
