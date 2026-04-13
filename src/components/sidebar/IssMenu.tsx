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
      className="relative h-full min-h-0 overflow-hidden lg:h-full"
    >
      <div className="absolute right-0 top-[1rem] flex gap-2 px-3">
        <calcite-icon icon="refresh" scale="s"></calcite-icon>
        <calcite-label scale="s">10 sec</calcite-label>
      </div>
      <div className="flex h-full min-h-0 flex-col">
        <hr className="mx-3 mb-3 shrink-0" />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto md:max-h-[calc(100vh-6.8rem)]">
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
        </main>
      </div>
    </calcite-list-item-group>
  );
}
