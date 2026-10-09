import os
import secrets
from typing import Optional


class FileShredder:
    """Provides secure ephemeral file shredding and unlinking on the desktop PC."""
    
    @staticmethod
    def shred_and_delete(file_path: str, passes: int = 1) -> bool:
        """
        Overwrites file contents with zeroes and removes the file from disk.
        """
        if not os.path.exists(file_path):
            return False

        try:
            length = os.path.getsize(file_path)
            with open(file_path, "r+b", buffering=0) as f:
                for _ in range(passes):
                    f.seek(0)
                    f.write(b"\x00" * length)
                    f.flush()
                    os.fsync(f.fileno())
                    
            os.remove(file_path)
            print("[Cleanup] Local temporary file removed")
            return True
        except Exception as e:
            print(f"[Shredder] Error during shredding: {e}")
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    return True
                except Exception:
                    return False
            return False


file_shredder = FileShredder()
