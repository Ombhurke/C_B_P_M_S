-- Migration: 007_user_alias_trigger.sql
-- Description: Automatically populate user alias with first 6 characters of email if not provided

BEGIN;

CREATE OR REPLACE FUNCTION cbpms_private.ensure_user_alias()
RETURNS TRIGGER AS $$
DECLARE
    curr_alias text;
    email_text text;
    default_alias text;
BEGIN
    curr_alias := TRIM(COALESCE(NEW.data->>'alias', ''));
    email_text := COALESCE(NEW.data->>'username', NEW.data->>'email', '');
    
    -- If alias is not set, default to first 6 characters of the email
    IF curr_alias = '' THEN
        default_alias := SUBSTRING(email_text FROM 1 FOR 6);
        IF default_alias = '' THEN
            default_alias := 'User';
        END IF;
        NEW.data := jsonb_set(NEW.data, '{alias}', to_jsonb(default_alias), true);
        NEW.data := jsonb_set(NEW.data, '{alias_chosen}', to_jsonb(false), true);
    ELSE
        -- Alias was explicitly provided
        NEW.data := jsonb_set(NEW.data, '{alias_chosen}', to_jsonb(true), true);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_user_alias ON cbpms_private.users;
CREATE TRIGGER trg_ensure_user_alias
BEFORE INSERT OR UPDATE ON cbpms_private.users
FOR EACH ROW
EXECUTE FUNCTION cbpms_private.ensure_user_alias();

COMMIT;
