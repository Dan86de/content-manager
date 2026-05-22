\restrict dbmate

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg13+1)
-- Dumped by pg_dump version 16.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    external_id text NOT NULL,
    url text NOT NULL,
    title text NOT NULL,
    author text,
    published_at timestamp with time zone NOT NULL,
    raw_text text,
    status text DEFAULT 'new'::text NOT NULL,
    score integer,
    score_reason text,
    draft_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT items_score_check CHECK (((score >= 0) AND (score <= 10))),
    CONSTRAINT items_status_check CHECK ((status = ANY (ARRAY['new'::text, 'kept'::text, 'dismissed'::text, 'drafted'::text])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: items items_source_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_source_external_id_key UNIQUE (source, external_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: electric_publication_default; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION electric_publication_default WITH (publish = 'insert, update, delete, truncate');


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20260521120000');
