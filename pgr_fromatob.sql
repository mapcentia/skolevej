create or replace function public.pgr_fromatob(tbl character varying, x1 double precision, y1 double precision, x2 double precision, y2 double precision, OUT seq integer, OUT gid integer, OUT name text, OUT heading double precision, OUT cost double precision, OUT length double precision, OUT geom geometry) returns SETOF record
    strict
    language plpgsql
as
$$
DECLARE
    sql    TEXT;
    rec    RECORD;
    source INTEGER;
    target INTEGER;
    point  INTEGER;

BEGIN
    -- Find nearest node
    EXECUTE 'SELECT id::integer FROM skolevej.vejmidte_vertices_pgr
                        ORDER BY the_geom <-> ST_Transform(ST_GeometryFromText(''POINT('
                || x1 || ' ' || y1 || ')'',4326),25832) LIMIT 1'
        INTO rec;
    source := rec.id;

    EXECUTE 'SELECT id::integer FROM skolevej.vejmidte_vertices_pgr
                        ORDER BY the_geom <-> ST_Transform(ST_GeometryFromText(''POINT('
                || x2 || ' ' || y2 || ')'',4326),25832) LIMIT 1'
        INTO rec;
    target := rec.id;

    -- Shortest path query (TODO: limit extent by BBOX)
    seq := 0;
    sql := 'SELECT gid, the_geom, name, cost, source, target,
                                ST_Reverse(the_geom) AS flip_geom, St_Length(the_geom) AS length FROM ' ||
           'pgr_astar(''SELECT gid as id, source::int, target::int, '
               || 'weight::float AS cost, x1, y1, x2, y2 FROM '
               || (tbl) || ''', '
               || source || ', ' || target
               || ', false), '
               || (tbl) || ' WHERE edge = gid ORDER BY seq';

    -- Remember start point
    point := source;

    FOR rec IN EXECUTE sql
        LOOP
            -- Flip geometry (if required)
            IF (point != rec.source)
            THEN
                rec.the_geom := rec.flip_geom;
                point := rec.source;
            ELSE
                point := rec.target;
            END IF;

            -- Calculate heading (simplified)
            EXECUTE 'SELECT degrees( ST_Azimuth(
                                ST_StartPoint(''' || rec.the_geom :: TEXT || '''),
                                ST_EndPoint(''' || rec.the_geom :: TEXT || ''') ) )'
                INTO heading;

            -- Return record
            seq := seq + 1;
            gid := rec.gid;
            name := rec.name;
            cost := rec.cost;
            length := rec.length;
            geom := rec.the_geom;
            RETURN NEXT;
        END LOOP;
    RETURN;
END;
$$;