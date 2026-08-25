import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { getActivityMaster } from "../lib/firestore";
import type { ActivityMaster } from "../types";

export function ActivityMasterPage() {
  const [activities, setActivities] = useState<ActivityMaster[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getActivityMaster().then(setActivities);
  }, []);

  const groupedActivities = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = activities.filter((activity) => {
      if (!term) return true;
      return `${activity.activityHead} ${activity.subActivity} ${activity.code}`.toLowerCase().includes(term);
    });

    return filtered.reduce<Record<string, ActivityMaster[]>>((groups, activity) => {
      groups[activity.activityHead] = [...(groups[activity.activityHead] || []), activity];
      return groups;
    }, {});
  }, [activities, search]);

  return (
    <>
      <PageHeader eyebrow="Master data" title="Activity master" description="Approved activity heads, sub-activities, and activity codes for Centre of Excellence monitoring." />

      <section className="filters single">
        <label>
          Search activities
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by activity or code" />
        </label>
      </section>

      <div className="activity-groups">
        {Object.entries(groupedActivities).map(([head, items]) => (
          <section className="activity-group" key={head}>
            <div className="section-title">
              <h2>{head}</h2>
              <span>{items.length} activities</span>
            </div>
            <div className="activity-list">
              {items.map((activity) => (
                <article className="activity-row" key={activity.id}>
                  <span>{activity.serialNo}</span>
                  <strong>{activity.subActivity}</strong>
                  <code>{activity.code}</code>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
