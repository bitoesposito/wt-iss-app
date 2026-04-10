import type { RootState } from "../../store";

export default function IssSidebarComponent({
    issPositions,
    onSetActiveIssPositionKey,
  }: {
    issPositions: RootState["iss"]["positions"];
    onSetActiveIssPositionKey: (key: string | null) => void;
  }) {
    return (
      <calcite-list-item-group
        heading="MAPPA ISS"
        className="lg:h-full overflow-hidden relative"
      >
        <div className="px-3 flex gap-2 absolute right-0 top-[1rem]">
          <calcite-icon icon="refresh" scale="s"></calcite-icon>
          <calcite-label scale="s">10 sec</calcite-label>
        </div>
        <hr className="mx-3 mb-3" />
        <div className="overflow-hidden">
          <div className="md:max-h-[calc(100vh-6.8rem)] md:overflow-y-auto">
            {issPositions.map((issPosition) => {
              const issPositionKey = `${issPosition.timestamp}-${issPosition.latitude}-${issPosition.longitude}`;
              const issPositionId = `iss-${issPositionKey}`;
  
              return (
                <calcite-action
                  key={issPositionKey}
                  id={issPositionId}
                  icon="pin"
                  text-enabled
                  text={`${issPosition.latitude.toFixed(6)}, ${issPosition.longitude.toFixed(6)}`}
                  scale="m"
                  onPointerEnter={() => onSetActiveIssPositionKey(issPositionKey)}
                  onPointerLeave={() => onSetActiveIssPositionKey(null)}
                  onFocus={() => onSetActiveIssPositionKey(issPositionKey)}
                  onBlur={() => onSetActiveIssPositionKey(null)}
                ></calcite-action>
              );
            })}
          </div>
        </div>
      </calcite-list-item-group>
    );
  }