import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { getPhases } from "../lib/firestore";
import { useAuth } from "../contexts/AuthContext";
import { getAccessibleDiets } from "../services/accessScopeService";
import type { Diet, Phase } from "../types";

export function DietListPage() {
  const { accessScope } = useAuth();
  const [diets, setDiets] = useState<Diet[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!accessScope) return;
    Promise.all([getAccessibleDiets(accessScope), getPhases()]).then(([dietData, phaseData]) => {
      setDiets(dietData);
      setPhases(phaseData);
    });
  }, [accessScope]);

  const phaseById = useMemo(() => new Map(phases.map((phase) => [phase.id, phase.name])), [phases]);
  const filteredDiets = diets.filter((diet) => {
    const phaseMatches = phaseFilter === "all" || diet.phaseId === phaseFilter;
    const statusMatches = statusFilter === "all" || diet.status === statusFilter;
    return phaseMatches && statusMatches;
  });

  return (
    <>
      <PageHeader eyebrow="DIET registry" title="DIET list" description="Phase and status-wise view of DIETs covered in the foundation data model." />

      <section className="filters">
        <label>
          Phase
          <select value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)}>
            <option value="all">All phases</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All status</option>
            <option value="planning">Planning</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="delayed">Delayed</option>
          </select>
        </label>
      </section>

      <section className="table-wrap">
        {!filteredDiets.length && !diets.length ? <div className="error-banner">No DIET master records are available in Firestore. Please seed or configure the DIET master.</div> : null}
        <table>
          <thead>
            <tr>
              <th>DIET</th>
              <th>District</th>
              <th>Phase</th>
              <th>Status</th>
              <th>Physical</th>
              <th>Financial</th>
            </tr>
          </thead>
          <tbody>
            {filteredDiets.map((diet) => (
              <tr key={diet.id}>
                <td>
                  <Link to={`/diets/${diet.id}`}>{diet.name}</Link>
                </td>
                <td>{diet.district}</td>
                <td>{phaseById.get(diet.phaseId) || diet.phaseYear}</td>
                <td>
                  <span className={`status-pill ${diet.status}`}>{diet.status.replace("_", " ")}</span>
                </td>
                <td>{diet.physicalProgressPercent}%</td>
                <td>{diet.financialProgressPercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
